import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: "ap-northeast-1" });
const cache = new Map<string, string>();

export async function getSecret(secretName: string): Promise<string> {
  if (cache.has(secretName)) return cache.get(secretName)!;
  const res = await client.send(new GetSecretValueCommand({ SecretId: secretName }));
  const val = res.SecretString!;
  cache.set(secretName, val);
  return val;
}
