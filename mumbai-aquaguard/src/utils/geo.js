// Geographic helpers used by the hazard map, route engine and duplicate detection.

const R = 6371000; // earth radius in metres
const rad = (d) => (d * Math.PI) / 180;

/** Great-circle distance between two lat/lng points, in metres. */
export function haversine(lat1, lng1, lat2, lng2) {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Shortest distance from a point to a polyline [[lat,lng], ...], in metres. */
export function distanceToPath(lat, lng, path) {
  if (!path || path.length === 0) return Infinity;
  if (path.length === 1) return haversine(lat, lng, path[0][0], path[0][1]);
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const d = distanceToSegment(lat, lng, path[i], path[i + 1]);
    if (d < best) best = d;
  }
  return best;
}

function distanceToSegment(lat, lng, a, b) {
  // Local flat-earth projection: accurate enough over a few hundred metres.
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos(rad(lat));
  const px = (lng - a[1]) * mPerDegLng;
  const py = (lat - a[0]) * mPerDegLat;
  const bx = (b[1] - a[1]) * mPerDegLng;
  const by = (b[0] - a[0]) * mPerDegLat;
  const len2 = bx * bx + by * by;
  if (len2 === 0) return Math.hypot(px, py);
  let t = (px * bx + py * by) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - t * bx, py - t * by);
}

/** Bounding box (in degrees) around a point, for cheap pre-filtering in Mongo. */
export function bbox(lat, lng, metres) {
  const dLat = metres / 111320;
  const dLng = metres / (111320 * Math.cos(rad(lat)) || 1);
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}
