import { ExtractionSchema, type FeedbackRecord } from "../../contract/feedback";

const { category, sentiment, severity } = ExtractionSchema.shape;

export type SortKey = "submittedAt" | "category" | "severity" | "sentiment";
export type Sort = { key: SortKey; dir: "asc" | "desc" };

export const DEFAULT_SORT: Sort = { key: "submittedAt", dir: "desc" };

type Compare = (a: FeedbackRecord, b: FeedbackRecord) => number;

const byRank =
  <T extends string>(options: readonly T[], pick: (r: FeedbackRecord) => T): Compare =>
  (a, b) =>
    options.indexOf(pick(a)) - options.indexOf(pick(b));

/** Ascending comparators. Enums sort by their order in the contract (severity: low < medium < high). */
const COMPARE: Record<SortKey, Compare> = {
  submittedAt: (a, b) => a.submittedAt.localeCompare(b.submittedAt), // ISO 8601 UTC sorts as text
  category: byRank(category.options, (r) => r.category),
  severity: byRank(severity.options, (r) => r.severity),
  sentiment: byRank(sentiment.options, (r) => r.sentiment), // positive < neutral < negative
};

/** First click: newest, most severe or most negative first; category in contract order (bug first). */
const FIRST_DIR: Record<SortKey, Sort["dir"]> = {
  submittedAt: "desc",
  severity: "desc",
  sentiment: "desc",
  category: "asc",
};

/** Clicking the active column flips direction; a new column starts at its natural direction. */
export function nextSort(current: Sort, key: SortKey): Sort {
  if (current.key !== key) return { key, dir: FIRST_DIR[key] };
  return { key, dir: current.dir === "asc" ? "desc" : "asc" };
}

export function sortRecords(records: readonly FeedbackRecord[], { key, dir }: Sort): FeedbackRecord[] {
  const sign = dir === "asc" ? 1 : -1;
  // Ties fall back to newest first.
  return [...records].sort((a, b) => sign * COMPARE[key](a, b) || COMPARE.submittedAt(b, a));
}
