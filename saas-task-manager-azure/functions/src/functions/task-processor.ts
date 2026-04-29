import { app, InvocationContext } from "@azure/functions";
import { Client } from "pg";

type TaskMessage = {
  taskId: string;
  title: string;
};

async function handler(message: TaskMessage | string, context: InvocationContext): Promise<void> {
  const parsed = typeof message === "string" ? (JSON.parse(message) as TaskMessage) : message;

  context.log(`Processing queued task: ${parsed.taskId} (${parsed.title})`);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for function processing.");
  }

  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    await client.query('UPDATE "Task" SET "processed" = true WHERE "id" = $1', [parsed.taskId]);
    context.log(`Task ${parsed.taskId} marked as processed.`);
  } finally {
    await client.end();
  }
}

app.storageQueue("taskProcessor", {
  connection: "AzureWebJobsStorage",
  queueName: process.env.AZURE_QUEUE_NAME || "tasks-queue",
  handler
});
