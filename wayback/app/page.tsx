"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import CaptureButton from "@/components/CaptureButton";
import HudPanel from "@/components/HudPanel";
import ModelStatusLine from "@/components/ModelStatusLine";
import { warmUp } from "@/lib/matcher";
import { setPendingPhoto } from "@/lib/pendingPhoto";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    warmUp();
  }, []);

  return (
    <main className="flex flex-1 flex-col gap-8">
      <header className="flex items-baseline justify-between">
        <h1 className="font-hud text-2xl font-bold tracking-[0.25em] text-glow drop-shadow-[0_0_10px_rgba(62,230,242,0.6)]">
          WAYBACK
        </h1>
        <span className="font-hud text-[10px] tracking-widest text-muted">M06 · TEKUN</span>
      </header>

      <section className="flex flex-col items-center gap-4 pt-4">
        <CaptureButton
          onPhoto={(file) => {
            setPendingPhoto(file);
            router.push("/locate?mode=park");
          }}
        />
        <p className="text-center text-sm text-muted">Snap your parking spot&apos;s surroundings.</p>
        <ModelStatusLine />
      </section>

      <HudPanel>
        <h2 className="font-hud text-xs tracking-[0.2em] text-muted">CURRENT PARKING</h2>
        <p className="mt-3 text-sm text-muted">Tap Capture when you park.</p>
      </HudPanel>

      <HudPanel tone="violet">
        <h2 className="font-hud text-xs tracking-[0.2em] text-muted">PARKING HISTORY</h2>
        <p className="mt-3 text-sm text-muted">No trips yet.</p>
      </HudPanel>
    </main>
  );
}
