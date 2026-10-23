"use client";

import { useRef } from "react";

type Props = {
  onPhoto: (file: File) => void;
  label?: string;
  size?: "big" | "small";
  /** Pick a saved image (e.g. a floor plan) instead of opening the camera. */
  fromGallery?: boolean;
};

/** Opens the phone camera (or a file picker on a laptop) and hands back one photo. */
export default function CaptureButton({ onPhoto, label = "Capture", size = "big", fromGallery = false }: Props) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture={fromGallery ? undefined : "environment"}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onPhoto(file);
        }}
      />
      {size === "big" ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="relative mx-auto grid h-40 w-40 place-items-center rounded-full border-2 border-glow bg-panel shadow-glow-lg transition active:scale-95"
        >
          <span className="absolute inset-3 rounded-full border border-glow/40 animate-pulse-glow" />
          <span className="flex flex-col items-center gap-2">
            <CameraIcon />
            <span className="font-hud text-sm tracking-[0.2em] text-glow">{label.toUpperCase()}</span>
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="w-full rounded-2xl border border-glow bg-glow/10 px-4 py-3 font-hud text-sm tracking-widest text-glow shadow-glow active:scale-[0.98]"
        >
          {label.toUpperCase()}
        </button>
      )}
    </>
  );
}

function CameraIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="text-glow drop-shadow-[0_0_6px_rgba(62,230,242,0.8)]"
    >
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
