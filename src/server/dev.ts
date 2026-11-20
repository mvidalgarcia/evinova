import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { createApp } from "./app";
import { createLlmClientFromEnv } from "./config";

const PORT = 8787;

// Config is read at startup, so a bad configuration fails here, not on the first request.
const app = createApp({ llm: createLlmClientFromEnv() });

// Request logging for local runs only; tests and the Lambda handler stay quiet.
const root = new Hono();
root.use(logger());
// Forward the raw request instead of mounting with `route()`, which would drop the app's own
// not-found and error handlers and answer unknown routes with Hono's plain-text 404.
root.all("*", (c) => app.fetch(c.req.raw));

serve({ fetch: root.fetch, port: PORT }, ({ port }) => {
  console.log(`API listening on http://localhost:${port}`);
});
