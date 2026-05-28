import { PubSub } from "@google-cloud/pubsub";
import { db } from "./db";
import { env } from "./env";

type JobMessage = {
  job_id: string;
  source_url: string;
  target_language: string;
};

let pubsubClient: PubSub | null = null;

function getPubSubClient(): PubSub {
  if (!pubsubClient) {
    pubsubClient = new PubSub({ projectId: env.gcpProjectId });
  }
  return pubsubClient;
}

export async function publishJob(message: JobMessage): Promise<void> {
  if (env.queueProvider === "gcp") {
    const client = getPubSubClient();
    const topic = client.topic(env.gcpPubSubTopic);
    await topic.publishMessage({ json: message });
    return;
  }

  await db.query(
    "INSERT INTO queue_messages (job_id, payload, status) VALUES ($1, $2::jsonb, 'PENDING')",
    [message.job_id, JSON.stringify(message)]
  );
}
