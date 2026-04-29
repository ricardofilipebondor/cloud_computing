import { BlobServiceClient, BlockBlobClient } from "@azure/storage-blob";
import { QueueClient } from "@azure/storage-queue";
import { randomUUID } from "crypto";
import { validateEnv } from "./env";

function getAzureClients() {
  validateEnv();
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING as string;
  const containerName = process.env.AZURE_BLOB_CONTAINER as string;
  const queueName = process.env.AZURE_QUEUE_NAME as string;

  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const queueClient = new QueueClient(connectionString, queueName);

  return { containerClient, queueClient };
}

export async function ensureAzureResources() {
  const { containerClient, queueClient } = getAzureClients();
  await containerClient.createIfNotExists({ access: "blob" });
  await queueClient.createIfNotExists();
}

export async function uploadTaskFile(file: File): Promise<string> {
  const { containerClient } = getAzureClients();
  await ensureAzureResources();
  const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const blobName = `tasks/${randomUUID()}.${extension}`;
  const blockBlobClient: BlockBlobClient = containerClient.getBlockBlobClient(blobName);
  const buffer = Buffer.from(await file.arrayBuffer());

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: file.type || "application/octet-stream" }
  });

  return blockBlobClient.url;
}

export async function sendTaskToQueue(payload: { taskId: string; title: string }) {
  const { queueClient } = getAzureClients();
  await ensureAzureResources();
  await queueClient.sendMessage(JSON.stringify(payload));
}
