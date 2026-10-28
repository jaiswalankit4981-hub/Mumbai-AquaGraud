import { env } from '../config/env.js';
import { distanceToPath, haversine } from '../utils/geo.js';
import { ApiError } from '../utils/asyncHandler.js';
import { activeHazards } from './hazardService.js';

/**
 * FR-16 to FR-19: get candidate routes, score each one against the live hazard
 * list, then label them Fastest / Safer / Balanced.
 *
 * Candidate routes come from, in order:
 *   1. the OSRM server in .env
 *   2. a second public OSRM server
 *   3. locally built estimated routes (works with no internet at all)
 */
const OSRM_SERVERS = [...new Set([env.osrmUrl, 'https://routing.openstreetmap.de/routed-car'])];

export async function findRoutes(start, destination) {
  const hazards = await activeHazards();
  const road = await fetchRoadRoutes(start, destination);
  return planRoutes(start, destination, hazards, road);
}

/** Pure function: easy to test without a database or network. */
export function planRoutes(start, destination, hazards, roadRoutes) {
  const estimated = !roadRoutes;
  const candidates = roadRoutes || estimatedRoutes(start, destination, hazards);

  const scored = candidates.map((route, index) => {
    const hit = hazardsOnPath(route.path, hazards);
    const riskScore = hit.reduce((sum, h) => sum + h.weight * proximityFactor(h.distance), 0);
    return {
      id: index,
      distanceKm: +(route.distanceM / 1000).toFixed(2),
      durationMin: Math.max(1, Math.round(route.durationS / 60)),
      path: route.path,
      hazards: hit,
      riskScore: Math.round(riskScore * 10) / 10,
      estimated
    };
  });

  return label(scored);
}

/** Tries each routing server; returns null if none can be reached. */
async function fetchRoadRoutes(start, destination) {
  const coords = `${start.lng},${start.lat};${destination.lng},${destination.lat}`;
  const query = '?alternatives=true&overview=full&geometries=geojson&steps=false';

  for (const base of OSRM_SERVERS) {
    try {
      const res = await fetch(`${base}/route/v1/driving/${coords}${query}`, {
        headers: { 'User-Agent': 'MumbaiAquaGuard/1.0' },
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.code === 'NoRoute') {
        throw new ApiError(400, 'No road connects those two points. Pick spots on land.');
      }
      if (data.code !== 'Ok' || !data.routes?.length) throw new Error(data.code || 'bad response');

      return data.routes.map((r) => ({
        distanceM: r.distance,
        durationS: r.duration,
        path: r.geometry.coordinates.map(([lng, lat]) => [lat, lng])
      }));
    } catch (e) {
      if (e instanceof ApiError) throw e;
      const why = e.cause?.code || e.cause?.message || e.message;
      console.error(`[route] ${base} failed: ${why}`);
    }
  }
  console.error('[route] no routing server reachable, using estimated routes');
  return null;
}

/**
 * Offline fallback: the direct line, plus a left and right detour around the
 * worst hazard sitting near that line. Not real roads, but it lets the hazard
 * scoring and the safer-route logic work without any external service.
 */
function estimatedRoutes(start, destination, hazards) {
  const s = [start.lat, start.lng];
  const d = [destination.lat, destination.lng];
  const paths = [[s, d]];

  const blocking = hazards
    .filter((h) => h.weight && distanceToPath(h.lat, h.lng, [s, d]) <= env.hazardBufferM * 2)
    .sort((a, b) => b.weight - a.weight);

  if (blocking.length) {
    const h = blocking[0];
    const mLat = 111320;
    const mLng = 111320 * Math.cos((h.lat * Math.PI) / 180);
    const dx = (destination.lng - start.lng) * mLng;
    const dy = (destination.lat - start.lat) * mLat;
    const len = Math.hypot(dx, dy) || 1;
    const offset = env.hazardBufferM * 3;

    for (const side of [1, -1]) {
      const wp = [
        h.lat + ((side * dx) / len) * (offset / mLat),
        h.lng + ((side * -dy) / len) * (offset / mLng)
      ];
      paths.push([s, wp, d]);
    }
  }

  return paths.map((path) => {
    let metres = 0;
    for (let i = 0; i < path.length - 1; i++) {
      metres += haversine(path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]);
    }
    metres *= 1.25; // straight lines understate real road distance
    return { distanceM: metres, durationS: metres / 6.9, path }; // about 25 km/h city speed
  });
}

function proximityFactor(distanceM) {
  // A hazard on the road matters more than one near the road.
  return 1 - Math.min(distanceM / env.hazardBufferM, 1) * 0.6;
}

function hazardsOnPath(path, hazards) {
  const out = [];
  for (const h of hazards) {
    if (!h.weight) continue;
    const d = distanceToPath(h.lat, h.lng, path);
    if (d <= env.hazardBufferM) out.push({ ...h, distance: Math.round(d) });
  }
  return out;
}

/** FR-18: pick one route for each of the three offered strategies. */
function label(routes) {
  const fastest = [...routes].sort((a, b) => a.durationMin - b.durationMin)[0];
  const safer = [...routes].sort(
    (a, b) => a.riskScore - b.riskScore || a.durationMin - b.durationMin
  )[0];
  const maxTime = Math.max(...routes.map((r) => r.durationMin)) || 1;
  const maxRisk = Math.max(...routes.map((r) => r.riskScore)) || 1;
  const blend = (r) => (r.durationMin / maxTime) * 0.5 + (r.riskScore / maxRisk) * 0.5;
  const balanced = [...routes].sort((a, b) => blend(a) - blend(b))[0];

  const tag = (route, type) => ({ ...route, type, warning: routeWarning(route) });
  const options = [tag(fastest, 'FASTEST'), tag(safer, 'SAFER'), tag(balanced, 'BALANCED')];

  // Drop duplicates when the same geometry wins more than one strategy.
  const seen = new Map();
  for (const o of options) {
    if (!seen.has(o.id)) seen.set(o.id, o);
    else seen.get(o.id).type += ` + ${o.type}`;
  }
  return [...seen.values()];
}

/** FR-19 */
function routeWarning(route) {
  const note = route.estimated ? ' (estimated path, live road data unavailable)' : '';
  if (!route.hazards.length) {
    return route.estimated ? `Estimated path, live road data unavailable.` : null;
  }
  const worst = route.hazards.reduce((a, b) => (b.weight > a.weight ? b : a), route.hazards[0]);
  if (worst.type === 'OPEN_MANHOLE') {
    return `This route passes an open manhole: ${worst.label}.${note}`;
  }
  if (worst.severity === 'CRITICAL') {
    return `This route passes through a severe waterlogging zone: ${worst.label}.${note}`;
  }
  return `This route passes ${route.hazards.length} reported hazard(s).${note}`;
}