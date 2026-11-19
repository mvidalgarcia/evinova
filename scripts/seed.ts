/**
 * Submits 25 invented feedback examples to a running API, one at a time.
 *
 *   pnpm seed                         # http://localhost:8787
 *   pnpm seed http://localhost:5173   # through the Vite proxy, or any other base URL
 *
 * With a real model, a 503 (e.g. the free tier's rate limit) is retried after a pause.
 */
import { FeedbackInputSchema } from "../src/contract/feedback";

const EXAMPLES = [
  // Bugs
  "The app crashes every time I upload a photo from my gallery.",
  "I can't log in since yesterday's update, it just shows a blank screen.",
  "I lost all my saved drafts after the app updated overnight.",
  "The export button on the reports page does nothing when I click it.",
  "Checkout fails with an error when I use a discount code.",
  "Search is really slow on mobile, it takes ages to show results.",
  "The date picker shows the wrong month after I switch time zones.",
  "Uploading a large CSV gets stuck at 99% and never finishes.",
  "The calendar view is broken in Safari, events overlap each other.",
  // Feature requests
  "Could you add CSV import for bulk uploading contacts?",
  "It would be great to have an option to schedule reports weekly.",
  "Please add support for two-factor authentication with an app.",
  "Can you add a keyboard shortcut to archive messages?",
  "I wish I could export the dashboard as a PDF for my manager.",
  "Would love an option to mute notifications on weekends.",
  "Support for Spanish in the interface would help our team a lot.",
  // Praise
  "Love the new dark mode, it makes evening work much easier on the eyes.",
  "Thanks for the quick reply from support yesterday, really helpful!",
  "The onboarding checklist is amazing, my team got started in minutes.",
  "Great job on the new search, results are fast and relevant.",
  "Your documentation is really helpful, I set everything up alone.",
  // Other
  "I changed my billing address last week, just letting you know.",
  "We're migrating our team next month, who should I talk to?",
  "Is there a student discount available for the annual plan?",
  "Our company was acquired, so our account name will change soon.",
] as const;

const RETRIES_ON_503 = 3;
const PAUSE_MS = 10_000;

const baseUrl = (process.argv[2] ?? "http://localhost:8787").replace(/\/+$/, "");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function submit(text: string): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`${baseUrl}/api/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(FeedbackInputSchema.parse({ text })),
    });
    const body: unknown = await response.json().catch(() => null);
    if (response.status === 503 && attempt < RETRIES_ON_503) {
      console.log(`  503, retrying in ${PAUSE_MS / 1000} s…`);
      await sleep(PAUSE_MS);
      continue;
    }
    if (response.status !== 201) return `${response.status} ${JSON.stringify(body)}`;
    const record = body as { category: string; sentiment: string; severity: string };
    return `201 ${record.category}/${record.sentiment}/${record.severity}`;
  }
}

let created = 0;
for (const [i, text] of EXAMPLES.entries()) {
  let outcome: string;
  try {
    outcome = await submit(text);
  } catch {
    console.error(`Can't reach ${baseUrl}. Is the API running (pnpm dev:api)?`);
    process.exit(1);
  }
  if (outcome.startsWith("201")) created++;
  console.log(`${String(i + 1).padStart(2)}. ${outcome.padEnd(36)} ${text.slice(0, 50)}`);
}
console.log(`\n${created}/${EXAMPLES.length} created at ${baseUrl}`);
