import type { FeedbackRecord } from "../../contract/feedback";
import { humanize } from "../lib/format";

/** What needs action now. Status never changes yet (no status updates), so "new" is every record. */
export function AttentionStats({ records }: { records: readonly FeedbackRecord[] }) {
  const high = records.filter((r) => r.severity === "high").length;
  const stats = [
    { label: "Total", value: records.length, tone: "" },
    // Red only when there is something to act on.
    { label: "High severity", value: high, tone: high > 0 ? "text-destructive" : "" },
    { label: "New (not triaged)", value: records.filter((r) => r.status === "new").length, tone: "" },
  ];
  return (
    <dl className="grid grid-cols-3 gap-4">
      {stats.map(({ label, value, tone }) => (
        <div key={label} className="space-y-1 rounded-lg border p-4">
          <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</dt>
          <dd className={`text-3xl font-semibold tabular-nums ${tone}`}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Counts<K extends string>({
  title,
  keys,
  records,
  pick,
}: {
  title: string;
  keys: readonly K[];
  records: readonly FeedbackRecord[];
  pick: (record: FeedbackRecord) => K;
}) {
  const max = Math.max(1, records.length);
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="text-sm font-medium">{title}</h2>
      <dl className="space-y-2">
        {keys.map((key) => {
          const count = records.filter((record) => pick(record) === key).length;
          return (
            <div key={key} className="grid grid-cols-[8rem_2rem_1fr] items-center gap-2 text-sm">
              <dt className="text-muted-foreground">{humanize(key)}</dt>
              <dd className="text-right tabular-nums">{count}</dd>
              <dd aria-hidden className="bg-accent h-2 rounded-full">
                <div className="bg-primary h-2 rounded-full" style={{ width: `${(count / max) * 100}%` }} />
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
