import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { handle } from "hono/aws-lambda";
import { createApp } from "./app";
import { createLlmClientFromEnv } from "./config";

/** Reads the model API key from Secrets Manager, so it never sits in the function's environment. */
async function readApiKey(secretId: string): Promise<string> {
  const { SecretString } = await new SecretsManagerClient().send(new GetSecretValueCommand({ SecretId: secretId }));
  if (!SecretString) throw new Error(`Secret ${secretId} has no string value`);
  return SecretString;
}

const secretId = process.env.LLM_API_KEY_SECRET_ID;
const env = secretId ? { ...process.env, LLM_API_KEY: await readApiKey(secretId) } : process.env;

// Runs once per cold start: a bad configuration or unreadable secret fails the init, not a request.
export const handler = handle(createApp({ llm: createLlmClientFromEnv(env) }));
