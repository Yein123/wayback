import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  tone?: "glow" | "violet" | "amber";
};

const corner = {
  glow: "border-glow",
  violet: "border-violet",
  amber: "border-amber",
};

/** Shared glowing panel with HUD corner brackets. */
export default function HudPanel({ children, className = "", tone = "glow" }: Props) {
  const c = corner[tone];
  return (
    <div className={`relative rounded-2xl border border-edge bg-panel/90 p-4 ${className}`}>
      <span className={`pointer-events-none absolute -left-px -top-px h-4 w-4 rounded-tl-2xl border-l-2 border-t-2 ${c}`} />
      <span className={`pointer-events-none absolute -right-px -top-px h-4 w-4 rounded-tr-2xl border-r-2 border-t-2 ${c}`} />
      <span className={`pointer-events-none absolute -bottom-px -left-px h-4 w-4 rounded-bl-2xl border-b-2 border-l-2 ${c}`} />
      <span className={`pointer-events-none absolute -bottom-px -right-px h-4 w-4 rounded-br-2xl border-b-2 border-r-2 ${c}`} />
      {children}
    </div>
  );
}
