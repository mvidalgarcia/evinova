import type { FeedbackRecord } from "../contract/feedback";

/** Swap point for a persistent store (e.g. DynamoDB). */
export interface FeedbackStore {
  add(record: FeedbackRecord): void;
  get(id: string): FeedbackRecord | undefined;
  /** Newest first. */
  list(): FeedbackRecord[];
}

/** Per process: lost on restart and not shared between Lambda instances. */
export function createMemoryStore(): FeedbackStore {
  const records = new Map<string, FeedbackRecord>();
  return {
    add: (record) => {
      records.set(record.id, record);
    },
    get: (id) => records.get(id),
    list: () => [...records.values()].reverse(),
  };
}
