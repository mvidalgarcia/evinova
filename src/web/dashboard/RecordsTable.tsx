import { Fragment, useMemo, useState, type ReactNode } from "react";
import type { FeedbackRecord } from "../../contract/feedback";
import { Badge } from "../components/ui/badge";
import { humanize } from "../lib/format";
import { Chevron, SortIcon } from "./icons";
import { DEFAULT_SORT, nextSort, sortRecords, type Sort, type SortKey } from "./sort";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

const SEVERITY_VARIANT = { high: "destructive", medium: "outline", low: "muted" } as const;

const COLUMNS: { label: string; sortKey?: SortKey }[] = [
  { label: "Submitted", sortKey: "submittedAt" },
  { label: "Category", sortKey: "category" },
  { label: "Severity", sortKey: "severity" },
  { label: "Sentiment", sortKey: "sentiment" },
  { label: "Status" },
  { label: "Summary" },
];

function ColumnHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey?: SortKey;
  sort: Sort;
  onSort: (key: SortKey) => void;
}) {
  if (!sortKey) return <th className="px-3 py-2 font-medium">{label}</th>;
  const active = sort.key === sortKey;
  return (
    <th
      className="px-3 py-2 font-medium"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={`Sort by ${label.toLowerCase()}`}
        className={`hover:bg-accent hover:text-foreground -mx-1.5 inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 ${active ? "text-foreground" : ""}`}
      >
        {label}
        <SortIcon dir={active ? sort.dir : undefined} />
      </button>
    </th>
  );
}

function Detail({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{term}</dt>
      <dd className="leading-relaxed whitespace-pre-wrap">{children}</dd>
    </div>
  );
}

function RecordRow({ record, open, onToggle }: { record: FeedbackRecord; open: boolean; onToggle: () => void }) {
  return (
    <Fragment>
      <tr className="border-b last:border-0">
        <td className="px-3 py-2">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-label={open ? "Hide details" : "Show details"}
            className="text-foreground/70 hover:text-foreground hover:bg-accent grid size-6 cursor-pointer place-items-center rounded"
          >
            <Chevron open={open} />
          </button>
        </td>
        <td className="px-3 py-2 whitespace-nowrap">{dateFormat.format(new Date(record.submittedAt))}</td>
        <td className="px-3 py-2">
          <Badge>{humanize(record.category)}</Badge>
        </td>
        <td className="px-3 py-2">
          <Badge variant={SEVERITY_VARIANT[record.severity]}>{record.severity}</Badge>
        </td>
        <td className="text-muted-foreground px-3 py-2">{record.sentiment}</td>
        <td className="px-3 py-2">
          <Badge variant="muted">{record.status}</Badge>
        </td>
        <td className="px-3 py-2">{record.summary}</td>
      </tr>
      {open && (
        <tr className="bg-accent/40 border-b last:border-0">
          <td />
          <td colSpan={COLUMNS.length} className="px-3 pt-2 pb-4">
            <dl className="grid gap-x-8 gap-y-4 md:grid-cols-2">
              <Detail term="Original feedback">{record.text}</Detail>
              <Detail term="Suggested action">{record.suggestedAction}</Detail>
            </dl>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

export function RecordsTable({ records }: { records: readonly FeedbackRecord[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  const sorted = useMemo(() => sortRecords(records, sort), [records, sort]);

  if (records.length === 0) {
    return <p className="text-muted-foreground rounded-lg border p-8 text-center text-sm">No feedback yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="text-muted-foreground border-b">
          <tr>
            <th className="w-10 px-3 py-2">
              <span className="sr-only">Details</span>
            </th>
            {COLUMNS.map((column) => (
              <ColumnHeader
                key={column.label}
                {...column}
                sort={sort}
                onSort={(key) => setSort((current) => nextSort(current, key))}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((record) => (
            <RecordRow
              key={record.id}
              record={record}
              open={openId === record.id}
              onToggle={() => setOpenId(openId === record.id ? null : record.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
