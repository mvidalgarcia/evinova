import { handle } from "hono/aws-lambda";
import { createApp } from "./app";
import { createLlmClientFromEnv } from "./config";

// Runs once per cold start: a bad configuration fails the init, not a request.
export const handler = handle(createApp({ llm: createLlmClientFromEnv() }));
