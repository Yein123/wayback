// Live GPS on the directions screen: where GPS puts you on the map right now, as you walk.
import { useEffect, useState } from "react";
import { gpsToMap, watchGps, type GpsAnchor } from "@/lib/gps";
import { loadAnchors } from "@/lib/matcher";

/** A spot on the map in metres, give or take `accuracy` metres. GPS can't tell floors. */
export type MapFix = { x: number; y: number; accuracy: number };

export type LiveGps =
  | { state: "off" }
  | { state: "waiting" }
  | { state: "unavailable"; reason: string }
  | { state: "fix"; fix: MapFix };

export function useLiveGps(on: boolean): LiveGps {
  // The latest fix or failure while GPS is on; nothing yet means still waiting.
  const [live, setLive] = useState<LiveGps | null>(null);

  useEffect(() => {
    if (!on) return;
    let stopped = false;
    let stop = () => {};
    void loadAnchors().then((anchors) => {
      if (stopped) return;
      if (anchors.length < 2) return setLive({ state: "unavailable", reason: "not surveyed yet" });
      stop = watchGps(
        (gps) => {
          const fix = gpsToMap(gps, anchors);
          if (fix) setLive({ state: "fix", fix });
        },
        () => setLive({ state: "unavailable", reason: "no signal" }),
      );
    });
    return () => {
      stopped = true;
      stop();
      setLive(null);
    };
  }, [on]);

  if (!on) return { state: "off" };
  return live ?? { state: "waiting" };
}

/** The surveyed GPS anchors, once loaded (also what turns map directions into compass bearings). */
export function useAnchors(): GpsAnchor[] | null {
  const [anchors, setAnchors] = useState<GpsAnchor[] | null>(null);
  useEffect(() => {
    let live = true;
    void loadAnchors().then((a) => live && setAnchors(a));
    return () => {
      live = false;
    };
  }, []);
  return anchors;
}
