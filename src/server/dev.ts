import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createLlmClientFromEnv } from "./config";

const PORT = 8787;

// Config is read at startup, so a bad configuration fails here, not on the first request.
const app = createApp({ llm: createLlmClientFromEnv() });

serve({ fetch: app.fetch, port: PORT }, ({ port }) => {
  console.log(`API listening on http://localhost:${port}`);
});
