import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FeedbackForm } from "./FeedbackForm";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-lg">
        <FeedbackForm />
      </div>
    </main>
  </StrictMode>,
);
