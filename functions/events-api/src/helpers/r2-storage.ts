import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

import {
  extensionForEventImageContentType,
  type AllowedEventImageContentType,
} from "../config/event-images";
import { getEventsApiEnv } from "../config/runtime-env";

const PRESIGN_EXPIRES_SEC = 600;

let s3Client: S3Client | null = null;

function getR2Config() {
  const env = getEventsApiEnv();
  return {
    accountId: env.r2AccountId,
    accessKeyId: env.r2AccessKeyId,
    secretAccessKey: env.r2SecretAccessKey,
    bucketName: env.r2BucketName,
    publicBaseUrl: env.r2PublicBaseUrl,
  };
}

export function isR2Configured(): boolean {
  const cfg = getR2Config();
  return Boolean(
    cfg.accountId &&
      cfg.accessKeyId &&
      cfg.secretAccessKey &&
      cfg.bucketName &&
      cfg.publicBaseUrl,
  );
}

function getS3Client(): S3Client {
  if (!isR2Configured()) {
    throw new Error("R2 is not configured");
  }
  if (!s3Client) {
    const cfg = getR2Config();
    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: cfg.accessKeyId!,
        secretAccessKey: cfg.secretAccessKey!,
      },
    });
  }
  return s3Client;
}

export function buildEventImageStorageKey(
  eventId: string,
  contentType: AllowedEventImageContentType,
): string {
  const ext = extensionForEventImageContentType(contentType);
  return `events/${eventId}/${randomUUID()}.${ext}`;
}

export function isValidEventImageStorageKey(
  eventId: string,
  storageKey: string,
): boolean {
  const prefix = `events/${eventId}/`;
  if (!storageKey.startsWith(prefix)) {
    return false;
  }
  const suffix = storageKey.slice(prefix.length);
  return /^[0-9a-f-]{36}\.(jpg|jpeg|png|webp|avif)$/i.test(suffix);
}

export function buildPublicUrl(storageKey: string): string {
  const base = getR2Config().publicBaseUrl;
  if (!base) {
    throw new Error("R2_PUBLIC_BASE_URL is not configured");
  }
  return `${base.replace(/\/+$/, "")}/${storageKey.replace(/^\/+/, "")}`;
}

export async function createPresignedPutUrl(params: {
  storageKey: string;
  contentType: AllowedEventImageContentType;
  byteSize: number;
}): Promise<string> {
  const cfg = getR2Config();
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: cfg.bucketName!,
    Key: params.storageKey,
    ContentType: params.contentType,
    ContentLength: params.byteSize,
  });
  return getSignedUrl(client, command, { expiresIn: PRESIGN_EXPIRES_SEC });
}

export async function deleteObject(storageKey: string): Promise<void> {
  if (!isR2Configured()) {
    return;
  }
  const cfg = getR2Config();
  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: cfg.bucketName!,
      Key: storageKey,
    }),
  );
}

/** @internal Test hook */
export function resetR2ClientForTests(): void {
  s3Client = null;
}
