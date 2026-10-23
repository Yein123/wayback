// Compass: which way the phone's back camera faces, in degrees from north (0 = N, 90 = E).
// Android Chrome sends absolute orientation; iPhone Safari gives webkitCompassHeading after a permission tap.
import { useEffect, useState } from "react";

type IOSOrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };
type IOSPermission = { requestPermission?: () => Promise<"granted" | "denied"> };

export type CompassState = { heading: number | null; needsPermission: boolean; enable: () => Promise<void> };

export function useCompass(): CompassState {
  const [heading, setHeading] = useState<number | null>(null);
  // iPhone Safari only gives the compass after a tap on a permission button.
  const [mustAsk] = useState(() => typeof window !== "undefined" && "DeviceOrientationEvent" in window && !!askFn());
  const [listening, setListening] = useState(false);
  const needsPermission = mustAsk && !listening;

  useEffect(() => {
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window) || needsPermission) return;
    const onIOS = (e: Event) => {
      const h = (e as IOSOrientationEvent).webkitCompassHeading;
      if (typeof h === "number") setHeading(h);
    };
    const onAbsolute = (e: Event) => {
      const alpha = (e as DeviceOrientationEvent).alpha;
      // alpha turns counter-clockwise from north; a compass heading turns clockwise.
      if (typeof alpha === "number") setHeading((360 - alpha) % 360);
    };
    window.addEventListener("deviceorientation", onIOS);
    window.addEventListener("deviceorientationabsolute", onAbsolute);
    return () => {
      window.removeEventListener("deviceorientation", onIOS);
      window.removeEventListener("deviceorientationabsolute", onAbsolute);
    };
  }, [needsPermission]);

  async function enable() {
    const ask = askFn();
    if (ask && (await ask()) !== "granted") return;
    setListening(true);
  }

  return { heading, needsPermission, enable };
}

function askFn(): (() => Promise<"granted" | "denied">) | undefined {
  const ask = (DeviceOrientationEvent as unknown as IOSPermission).requestPermission;
  return ask?.bind(DeviceOrientationEvent);
}

/** 47 → "NE 47°". */
export function compassName(heading: number): string {
  const names = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return `${names[Math.round(heading / 45) % 8]} ${Math.round(heading)}°`;
}

/** 5.355123, 100.296341 → "5.35512° N, 100.29634° E". */
export function latLngName(lat: number, lng: number): string {
  return `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(5)}° ${lng >= 0 ? "E" : "W"}`;
}
