export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/streamsync",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret",
  queueProvider: process.env.QUEUE_PROVIDER ?? "local",
  storageProvider: process.env.STORAGE_PROVIDER ?? "local",
  gcpProjectId: process.env.GCP_PROJECT_ID,
  gcpPubSubTopic: process.env.GCP_PUBSUB_TOPIC ?? "streamsync-jobs"
};
