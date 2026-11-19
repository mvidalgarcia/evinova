import type { Extraction } from "../../contract/feedback";
import type { LlmClient } from "./client";

/**
 * Opt-in offline stand-in (LLM_PROVIDER=fake). Not a model: picks a plausible
 * extraction from keywords in the feedback, so the dashboard shows varied data.
 * Same text, same reply. The reply still goes through the Zod gate.
 */
type Rule = { pattern: RegExp; extraction: Omit<Extraction, "summary"> };

// First match wins, so the more specific rules come first.
const RULES: readonly Rule[] = [
  {
    pattern: /crash|data loss|lost (my|all)|can'?t (log ?in|sign ?in|access)|cannot|every time|blank screen/i,
    extraction: {
      category: "bug",
      sentiment: "negative",
      severity: "high",
      suggestedAction: "Reproduce the failure and prioritise a fix for the next release.",
    },
  },
  {
    pattern: /bug|broken|error|does ?n[o']t work|does nothing|wrong|fails?|slow|freez|stuck/i,
    extraction: {
      category: "bug",
      sentiment: "negative",
      severity: "medium",
      suggestedAction: "Investigate the reported behaviour and schedule a fix.",
    },
  },
  {
    pattern: /could you|can you|please add|would (be|love)|wish|feature|support for|option to|ability to/i,
    extraction: {
      category: "feature_request",
      sentiment: "neutral",
      severity: "low",
      suggestedAction: "Add the request to the product backlog for prioritisation.",
    },
  },
  {
    pattern: /love|great|awesome|thank|amazing|nice|helpful|easier/i,
    extraction: {
      category: "praise",
      sentiment: "positive",
      severity: "low",
      suggestedAction: "Share with the team; no action needed.",
    },
  },
];

const FALLBACK: Rule["extraction"] = {
  category: "other",
  sentiment: "neutral",
  severity: "low",
  suggestedAction: "Review manually; the fake model could not classify it.",
};

/** The fake sees the full prompt; the feedback is the text between the <feedback> tags. */
function feedbackFrom(prompt: string): string {
  const match = /<feedback>\n([\s\S]*?)\n<\/feedback>/.exec(prompt);
  // Undo the prompt's escaping of a closing tag inside the feedback.
  return (match?.[1] ?? prompt).replaceAll("&lt;/feedback&gt;", "</feedback>").trim();
}

function summarise(text: string): string {
  const oneLine = text.replace(/\s+/g, " ");
  return oneLine.length <= 120 ? oneLine : `${oneLine.slice(0, 119)}…`;
}

export function createFakeClient(): LlmClient {
  return {
    complete: async (prompt: string): Promise<string> => {
      const text = feedbackFrom(prompt);
      const extraction = RULES.find((rule) => rule.pattern.test(text))?.extraction ?? FALLBACK;
      return JSON.stringify({ ...extraction, summary: summarise(text) } satisfies Extraction);
    },
  };
}
