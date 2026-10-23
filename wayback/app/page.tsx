"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CaptureButton from "@/components/CaptureButton";
import HistoryList from "@/components/HistoryList";
import ModelStatusLine from "@/components/ModelStatusLine";
import ParkingCard from "@/components/ParkingCard";
import { warmUp } from "@/lib/matcher";
import { useParkings } from "@/lib/parkings";
import { setPendingPhoto } from "@/lib/pendingPhoto";

export default function Home() {
  const router = useRouter();
  const { loading, current, history, error } = useParkings();

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
        <p className="text-center text-sm text-muted">Snap around your parking spot.</p>
        <Link
          href="/destination"
          className="rounded-2xl border border-violet/60 bg-violet/10 px-6 py-3 font-hud text-sm tracking-[0.3em] text-violet active:scale-[0.98]"
        >
          WHERE TO?
        </Link>
        <ModelStatusLine />
      </section>

      <ParkingCard parking={current} loading={loading} />
      {error && <p className="text-xs text-amber">Couldn&apos;t load your parkings: {error}</p>}
      <HistoryList history={history} />
    </main>
  );
}
