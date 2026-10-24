// GPS Stamp: one reading, never blocking. Indoors or underground it often fails, and that's fine.

export type Gps = { lat: number; lng: number; accuracy: number };

export function getGps(timeoutMs = 5000): Promise<Gps | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}

/** Live GPS while you walk: calls back on every new fix. Returns a function that stops it. */
export function watchGps(onFix: (gps: Gps) => void, onFail: () => void): () => void {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    onFail();
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (p) => onFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
    onFail,
    { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

/** A real GPS reading taken at a known spot on the map, collected during the survey. */
export type GpsAnchor = { lat: number; lng: number; pos: [number, number] };

type Fit = { ar: number; ai: number; place: (g: [number, number]) => [number, number]; ground: (lat: number, lng: number) => [number, number]; miss: number };

/**
 * Fits map = a·ground + b over the anchors, with a, b complex numbers (rotation + scale, shift; least squares),
 * so the map doesn't need to face north. Null with fewer than two anchors.
 */
function fitAnchors(anchors: GpsAnchor[]): Fit | null {
  if (anchors.length < 2) return null;
  const lat0 = anchors[0].lat;
  const lng0 = anchors[0].lng;
  const mPerLat = 111_320;
  const mPerLng = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  // Ground metres: x east, y south (the same way round as the map's axes).
  const ground = (lat: number, lng: number): [number, number] => [(lng - lng0) * mPerLng, -(lat - lat0) * mPerLat];

  const g = anchors.map((a) => ground(a.lat, a.lng));
  const m = anchors.map((a) => a.pos);
  const n = anchors.length;
  const gm = g.reduce((s, p) => [s[0] + p[0] / n, s[1] + p[1] / n], [0, 0]);
  const mm = m.reduce((s, p) => [s[0] + p[0] / n, s[1] + p[1] / n], [0, 0]);
  let re = 0;
  let im = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const [gx, gy] = [g[i][0] - gm[0], g[i][1] - gm[1]];
    const [mx, my] = [m[i][0] - mm[0], m[i][1] - mm[1]];
    re += gx * mx + gy * my;
    im += gx * my - gy * mx;
    den += gx * gx + gy * gy;
  }
  if (den === 0) return null;
  const [ar, ai] = [re / den, im / den];
  const place = ([gx, gy]: [number, number]): [number, number] => {
    const [dx, dy] = [gx - gm[0], gy - gm[1]];
    return [mm[0] + ar * dx - ai * dy, mm[1] + ai * dx + ar * dy];
  };
  // The anchors' own readings are rough too: how far the fit misses them adds to the uncertainty.
  const miss = n > 2 ? Math.sqrt(g.reduce((s, p, i) => s + Math.hypot(place(p)[0] - m[i][0], place(p)[1] - m[i][1]) ** 2, 0) / (n - 2)) : 0;
  return { ar, ai, place, ground, miss };
}

/**
 * Where a GPS fix lands on the map (metres from the lift lobby), from two or more anchors.
 * Returns null with fewer than two anchors: then the GPS pin is simply off.
 */
export function gpsToMap(fix: Gps, anchors: GpsAnchor[]): { x: number; y: number; accuracy: number } | null {
  const f = fitAnchors(anchors);
  if (!f) return null;
  const [x, y] = f.place(f.ground(fix.lat, fix.lng));
  return { x, y, accuracy: Math.hypot(fix.accuracy * Math.hypot(f.ar, f.ai), f.miss) };
}

/** The real compass bearing (0 = N, 90 = E) of a direction on the map, from the anchors; null without two. */
export function mapBearing([dx, dy]: [number, number], anchors: GpsAnchor[]): number | null {
  const f = fitAnchors(anchors);
  if (!f || (dx === 0 && dy === 0)) return null;
  // ground = map / a, up to scale
  const east = dx * f.ar + dy * f.ai;
  const south = dy * f.ar - dx * f.ai;
  return ((Math.atan2(east, -south) * 180) / Math.PI + 360) % 360;
}
