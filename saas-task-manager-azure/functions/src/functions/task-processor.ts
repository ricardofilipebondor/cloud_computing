import { app, InvocationContext } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";
import sql, { config as SqlConfig } from "mssql";

type TaskMessage = {
  taskId: string;
  title: string;
};

type DbTaskRow = {
  id: string;
  fileUrl: string | null;
};

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) {
    return defaultValue;
  }
  return value.toLowerCase() === "true";
}

function parseSqlServerPrismaUrl(databaseUrl: string): SqlConfig {
  if (!databaseUrl.startsWith("sqlserver://")) {
    throw new Error("DATABASE_URL must start with sqlserver://");
  }

  const raw = databaseUrl.slice("sqlserver://".length);
  const [hostPart, ...paramParts] = raw.split(";");
  const [server, portString] = hostPart.split(":");
  const params = new Map<string, string>();

  for (const part of paramParts) {
    if (!part.includes("=")) {
      continue;
    }
    const [key, ...valueParts] = part.split("=");
    params.set(key.trim().toLowerCase(), valueParts.join("=").trim());
  }

  const database = params.get("database");
  const user = params.get("user");
  const password = params.get("password");

  if (!server || !database || !user || !password) {
    throw new Error("DATABASE_URL is missing required SQL Server fields.");
  }

  return {
    server,
    port: portString ? Number(portString) : 1433,
    database,
    user: decodeURIComponent(user),
    password: decodeURIComponent(password),
    options: {
      encrypt: parseBoolean(params.get("encrypt"), true),
      trustServerCertificate: parseBoolean(params.get("trustservercertificate"), false)
    }
  };
}

function isTextFile(blobName: string, contentType?: string): boolean {
  if (contentType) {
    const normalized = contentType.toLowerCase();
    if (
      normalized.startsWith("text/") ||
      normalized === "application/json" ||
      normalized === "application/xml"
    ) {
      return true;
    }
  }

  const extension = blobName.includes(".") ? blobName.split(".").pop()?.toLowerCase() : "";
  return ["txt", "md", "csv", "json", "xml", "log"].includes(extension ?? "");
}

function summarizeText(rawText: string): string | null {
  const normalized = rawText.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length <= 2) {
    return normalized.slice(0, 400);
  }

  return `${sentences[0]} ${sentences[1]}`.slice(0, 500);
}

async function summarizeWithAzureOpenAI(text: string, context: InvocationContext): Promise<string | null> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-10-21";

  if (!endpoint || !apiKey || !deployment) {
    return null;
  }

  const normalizedEndpoint = endpoint.replace(/\/+$/, "");
  const url = `${normalizedEndpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey
      },
      signal: controller.signal,
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content:
              "You summarize plain-text attachments for task management. Return a concise summary in maximum 3 sentences."
          },
          {
            role: "user",
            content: text.slice(0, 8000)
          }
        ],
        temperature: 0.2,
        max_tokens: 220
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      context.warn(`Azure OpenAI summary request failed: ${response.status} ${errorBody}`);
      return null;
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content?.trim();
    return content ? content.slice(0, 700) : null;
  } catch (error) {
    context.warn("Azure OpenAI summary request failed, using local summarizer.", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function getBlobNameFromUrl(fileUrl: string, containerName: string): string | null {
  try {
    const parsedUrl = new URL(fileUrl);
    const path = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ""));
    const prefix = `${containerName}/`;
    if (!path.startsWith(prefix)) {
      return null;
    }
    return path.slice(prefix.length);
  } catch {
    return null;
  }
}

async function readTextFromAttachment(fileUrl: string, context: InvocationContext): Promise<string | null> {
  const storageConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage;
  const containerName = process.env.AZURE_BLOB_CONTAINER || "uploads";
  if (!storageConnectionString) {
    context.warn("No storage connection string available for summarization.");
    return null;
  }

  const blobName = getBlobNameFromUrl(fileUrl, containerName);
  if (!blobName) {
    context.warn(`Skipping summary, cannot parse blob name from URL: ${fileUrl}`);
    return null;
  }

  const blobService = BlobServiceClient.fromConnectionString(storageConnectionString);
  const blobClient = blobService.getContainerClient(containerName).getBlobClient(blobName);
  const properties = await blobClient.getProperties();
  if (!isTextFile(blobName, properties.contentType)) {
    return null;
  }

  const downloadResponse = await blobClient.download();
  if (!downloadResponse.readableStreamBody) {
    return null;
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of downloadResponse.readableStreamBody) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    chunks.push(buffer);
    totalBytes += buffer.length;
    if (totalBytes > 200_000) {
      break;
    }
  }

  return Buffer.concat(chunks).toString("utf-8");
}

async function buildSummaryFromAttachment(fileUrl: string, context: InvocationContext): Promise<string | null> {
  const text = await readTextFromAttachment(fileUrl, context);
  if (!text) {
    context.log("Summary skipped: attachment is missing, unreadable, or not text.");
    return null;
  }

  const openAiSummary = await summarizeWithAzureOpenAI(text, context);
  if (openAiSummary) {
    context.log("Summary generated with Azure OpenAI.");
    return openAiSummary;
  }

  context.log("Summary generated with local fallback summarizer.");
  return summarizeText(text);
}

async function handler(message: TaskMessage | string, context: InvocationContext): Promise<void> {
  const parsed = typeof message === "string" ? (JSON.parse(message) as TaskMessage) : message;

  context.log(`Processing queued task: ${parsed.taskId} (${parsed.title})`);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for function processing.");
  }

  const sqlConfig = parseSqlServerPrismaUrl(databaseUrl);
  const pool = await sql.connect(sqlConfig);
  try {
    const taskResult = await pool
      .request()
      .input("taskId", sql.NVarChar(191), parsed.taskId)
      .query<DbTaskRow>("SELECT [id], [fileUrl] FROM [Task] WHERE [id] = @taskId");

    const task = taskResult.recordset[0];
    let summary: string | null = null;
    if (task?.fileUrl) {
      try {
        summary = await buildSummaryFromAttachment(task.fileUrl, context);
      } catch (error) {
        context.error(`Failed to summarize attachment for task ${parsed.taskId}`, error);
      }
    }

    await pool
      .request()
      .input("taskId", sql.NVarChar(191), parsed.taskId)
      .input("summary", sql.NVarChar(sql.MAX), summary)
      .query("UPDATE [Task] SET [processed] = 1, [summary] = @summary WHERE [id] = @taskId");
    context.log(`Task ${parsed.taskId} marked as processed.`);
  } finally {
    await pool.close();
  }
}

app.storageQueue("taskProcessor", {
  connection: "AzureWebJobsStorage",
  queueName: process.env.AZURE_QUEUE_NAME || "tasksqueue",
  handler
});
