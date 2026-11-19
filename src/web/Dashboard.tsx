import { useCallback, useEffect, useState } from "react";
import { ExtractionSchema, type FeedbackRecord } from "../contract/feedback";
import { listFeedback } from "./api";
import { Button } from "./components/ui/button";
import { RecordsTable } from "./dashboard/RecordsTable";
import { AttentionStats, Counts } from "./dashboard/Summary";

type State =
  | { kind: "loading" }
  | { kind: "loaded"; records: FeedbackRecord[] }
  | { kind: "failed"; message: string };

const { category, severity } = ExtractionSchema.shape;

export function Dashboard() {
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const result = await listFeedback();
    setState(result.ok ? { kind: "loaded", records: result.records } : { kind: "failed", message: result.message });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Feedback</h1>
          <p className="text-muted-foreground text-sm">
            {state.kind === "loaded" ? `${state.records.length} records` : " "}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <a href="/" className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline">
            Open feedback form
          </a>
          <Button variant="outline" onClick={() => void load()} disabled={state.kind === "loading"}>
            {state.kind === "loading" ? "Loading…" : "Refresh"}
          </Button>
        </div>
      </header>

      {state.kind === "failed" && (
        <p role="alert" className="border-destructive/30 text-destructive rounded-md border px-3 py-2 text-sm">
          {state.message}
        </p>
      )}

      {state.kind === "loaded" && (
        <>
          <AttentionStats records={state.records} />
          <div className="grid gap-4 md:grid-cols-2">
            <Counts title="By category" keys={category.options} records={state.records} pick={(r) => r.category} />
            <Counts title="By severity" keys={severity.options} records={state.records} pick={(r) => r.severity} />
          </div>
          <RecordsTable records={state.records} />
        </>
      )}
    </div>
  );
}
