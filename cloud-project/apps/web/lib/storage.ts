import fs from "fs/promises";
import path from "path";
import { Storage } from "@google-cloud/storage";
import { env } from "./env";

const rootDir = path.resolve(process.cwd(), "..", "..", "local_storage");

let storageClient: Storage | null = null;

function getStorageClient(): Storage {
  if (!storageClient) {
    storageClient = new Storage({ projectId: env.gcpProjectId });
  }
  return storageClient;
}

export async function readSubtitleFile(storagePath: string): Promise<string> {
  if (env.storageProvider === "gcs") {
    const bucketName = process.env.GCS_BUCKET_NAME;
    if (!bucketName) throw new Error("Missing GCS_BUCKET_NAME");
    const bucket = getStorageClient().bucket(bucketName);
    const [content] = await bucket.file(storagePath).download();
    return content.toString("utf-8");
  }

  const fullPath = path.join(rootDir, storagePath);
  return fs.readFile(fullPath, "utf-8");
}

export async function deleteSubtitleFile(storagePath: string): Promise<void> {
  if (!storagePath) return;

  if (env.storageProvider === "gcs") {
    const bucketName = process.env.GCS_BUCKET_NAME;
    if (!bucketName) return;
    const bucket = getStorageClient().bucket(bucketName);
    await bucket.file(storagePath).delete({ ignoreNotFound: true });
    return;
  }

  const fullPath = path.join(rootDir, storagePath);
  await fs.rm(fullPath, { force: true });
}
