"use client";

import { useEffect, useState } from "react";
import { onModelStatus, type ModelStatus } from "@/lib/matcher";

/** One quiet line showing whether the in-browser AI is ready. */
export default function ModelStatusLine() {
  const [status, setStatus] = useState<ModelStatus>({ state: "idle" });
  useEffect(() => onModelStatus(setStatus), []);

  const text =
    status.state === "ready"
      ? "AI online"
      : status.state === "error"
        ? "AI offline · check your connection"
        : status.state === "loading"
          ? `Waking up the AI…${status.percent !== null ? ` ${status.percent}%` : ""}`
          : "";
  const color = status.state === "ready" ? "text-glow" : status.state === "error" ? "text-amber" : "text-muted";

  return (
    <p className={`flex h-4 items-center gap-2 font-hud text-[10px] tracking-widest ${color}`}>
      {text && (
        <span className={`h-1.5 w-1.5 rounded-full bg-current ${status.state === "ready" ? "" : "animate-pulse-glow"}`} />
      )}
      {text.toUpperCase()}
    </p>
  );
}
