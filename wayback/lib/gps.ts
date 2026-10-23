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

/** A real GPS reading taken at a known spot on the map, collected during the survey. */
export type GpsAnchor = { lat: number; lng: number; pos: [number, number] };

/**
 * Where a GPS fix lands on the map (metres from the lift lobby), from two or more anchors.
 * Fits a scale + rotation + shift (least squares), so the map doesn't need to face north.
 * Returns null with fewer than two anchors: then the GPS pin is simply off.
 */
export function gpsToMap(fix: Gps, anchors: GpsAnchor[]): { x: number; y: number; accuracy: number } | null {
  if (anchors.length < 2) return null;
  const lat0 = anchors[0].lat;
  const lng0 = anchors[0].lng;
  const mPerLat = 111_320;
  const mPerLng = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  // Ground metres: x east, y south (the same way round as the map).
  const ground = (lat: number, lng: number): [number, number] => [(lng - lng0) * mPerLng, -(lat - lat0) * mPerLat];

  // Solve map = a·ground + b with a, b complex numbers (rotation+scale, shift).
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
  const [px, py] = ground(fix.lat, fix.lng);
  const [dx, dy] = [px - gm[0], py - gm[1]];
  return { x: mm[0] + ar * dx - ai * dy, y: mm[1] + ai * dx + ar * dy, accuracy: fix.accuracy * Math.hypot(ar, ai) };
}
