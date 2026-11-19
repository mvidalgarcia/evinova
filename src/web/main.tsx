import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Dashboard } from "./Dashboard";
import { FeedbackForm } from "./FeedbackForm";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

// Two pages, picked by path; no router dependency (see DECISIONS.md, "With more time").
const isDashboard = window.location.pathname.replace(/\/+$/, "") === "/dashboard";

createRoot(root).render(
  <StrictMode>
    {isDashboard ? (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Dashboard />
      </main>
    ) : (
      <main className="grid min-h-dvh place-items-center px-4 py-12">
        <div className="w-full max-w-lg">
          <FeedbackForm />
        </div>
      </main>
    )}
  </StrictMode>,
);
