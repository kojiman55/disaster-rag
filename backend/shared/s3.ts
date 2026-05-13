import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: "ap-northeast-1" });
const BUCKET = process.env.BUCKET_NAME!;

export async function getJson<T>(key: string): Promise<T | null> {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const body = await res.Body!.transformToString("utf-8");
    return JSON.parse(body) as T;
  } catch (e: unknown) {
    if ((e as { name?: string }).name === "NoSuchKey") return null;
    throw e;
  }
}

export async function putJson(key: string, data: unknown): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: JSON.stringify(data),
      ContentType: "application/json",
    })
  );
}
