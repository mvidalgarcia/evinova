import { type SubmitEvent, useId, useState } from "react";
import { FeedbackInputSchema } from "../contract/feedback";
import { submitFeedback } from "./api";
import { Button } from "./components/ui/button";
import { Textarea } from "./components/ui/textarea";

// Limits come from the shared contract, so the form and the API can't disagree.
const MIN = FeedbackInputSchema.shape.text.minLength ?? 0;
const MAX = FeedbackInputSchema.shape.text.maxLength ?? Number.POSITIVE_INFINITY;

type Status =
  | { kind: "editing" }
  | { kind: "submitting" }
  | { kind: "sent" }
  | { kind: "failed"; message: string };

function lengthMessage(text: string): string {
  return text.trim().length < MIN
    ? `Please write at least ${MIN} characters.`
    : `Please keep it under ${MAX} characters.`;
}

export function FeedbackForm() {
  const [text, setText] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "editing" });
  const ids = { field: useId(), hint: useId(), error: useId() };

  const validation = FeedbackInputSchema.safeParse({ text });
  const fieldError = showErrors && !validation.success ? lengthMessage(text) : undefined;
  const submitting = status.kind === "submitting";

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowErrors(true);
    if (!validation.success) return;

    setStatus({ kind: "submitting" });
    const result = await submitFeedback(validation.data.text);
    if (result.ok) {
      setText("");
      setShowErrors(false);
      setStatus({ kind: "sent" });
    } else {
      // Keep the text so nothing the person wrote is lost.
      setStatus({ kind: "failed", message: result.message });
    }
  }

  if (status.kind === "sent") {
    return (
      <div className="space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">✓ Thanks, we got it.</h1>
          <p className="text-muted-foreground text-sm">Your feedback helps us improve.</p>
        </div>
        <Button variant="outline" onClick={() => setStatus({ kind: "editing" })}>
          Send more feedback
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          <label htmlFor={ids.field}>Share your feedback</label>
        </h1>
        <p className="text-muted-foreground text-sm">Tell us what's working and what isn't.</p>
      </div>

      <div className="space-y-2">
        <Textarea
          id={ids.field}
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={MAX}
          disabled={submitting}
          autoFocus
          placeholder="The export button on the reports page does nothing when I click it…"
          aria-invalid={fieldError !== undefined}
          aria-describedby={fieldError ? `${ids.error} ${ids.hint}` : ids.hint}
        />
        <div className="text-muted-foreground flex justify-between text-xs">
          <span id={ids.hint}>At least {MIN} characters</span>
          <span aria-hidden>
            {text.length} / {MAX}
          </span>
        </div>
        {fieldError && (
          <p id={ids.error} className="text-destructive text-sm">
            {fieldError}
          </p>
        )}
      </div>

      {status.kind === "failed" && (
        <p role="alert" className="border-destructive/30 text-destructive rounded-md border px-3 py-2 text-sm">
          {status.message}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? "Sending…" : "Send feedback"}
        </Button>
      </div>
    </form>
  );
}
