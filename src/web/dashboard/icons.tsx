import type { Sort } from "./sort";

/** Points right when closed, down when open. */
export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 3.5 10.5 8 6 12.5" />
    </svg>
  );
}

/** Up-down arrows when the column isn't sorted; one arrow for the current direction when it is. */
export function SortIcon({ dir }: { dir: Sort["dir"] | undefined }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={`size-3.5 ${dir ? "" : "opacity-40"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {dir !== "desc" && <path d="M5 6.5 8 3.5l3 3" />}
      {dir !== "asc" && <path d="M5 9.5 8 12.5l3-3" />}
    </svg>
  );
}
