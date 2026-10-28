import Incident from '../models/Incident.js';
import Manhole from '../models/Manhole.js';
import Location from '../models/Location.js';
import SOSAlert from '../models/SOSAlert.js';

const SEVERITY_WEIGHT = { LOW: 1, MEDIUM: 2, HIGH: 4, CRITICAL: 8 };

/**
 * One normalised list of everything the map and the route engine treat as a hazard
 * (FR-28, FR-17). Each item: { id, kind, type, severity, lat, lng, label, weight }.
 */
export async function activeHazards({ includeSos = false } = {}) {
  const [incidents, manholes, locations, sos] = await Promise.all([
    Incident.find({ status: { $in: ['ACTIVE', 'MONITORING'] } }).lean(),
    Manhole.find({ status: { $in: ['OPEN', 'UNDER_INSPECTION'] } }).lean(),
    Location.find({ waterStatus: { $in: ['WATERLOGGED', 'CRITICAL'] } }).lean(),
    includeSos ? SOSAlert.find({ status: { $in: ['ACTIVE', 'ACKNOWLEDGED'] } }).lean() : []
  ]);

  const list = [];

  for (const i of incidents) {
    list.push({
      id: String(i._id),
      kind: 'incident',
      type: i.type,
      severity: i.severity,
      lat: i.lat,
      lng: i.lng,
      label: i.description || i.type.replace(/_/g, ' ').toLowerCase(),
      weight: SEVERITY_WEIGHT[i.severity] || 2
    });
  }

  for (const m of manholes) {
    list.push({
      id: String(m._id),
      kind: 'manhole',
      type: 'OPEN_MANHOLE',
      severity: m.submerged ? 'CRITICAL' : 'HIGH',
      lat: m.lat,
      lng: m.lng,
      label: m.submerged
        ? `${m.manholeId} open and hidden by water`
        : `${m.manholeId} cover open or displaced`,
      weight: m.submerged ? 10 : 6
    });
  }

  for (const l of locations) {
    list.push({
      id: String(l._id),
      kind: 'location',
      type: 'WATERLOGGING',
      severity: l.waterStatus === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      lat: l.lat,
      lng: l.lng,
      label: `${l.name}: ${l.waterDepth} cm of water`,
      weight: l.waterStatus === 'CRITICAL' ? 8 : 4
    });
  }

  for (const s of sos) {
    list.push({
      id: String(s._id),
      kind: 'sos',
      type: 'SOS',
      severity: 'CRITICAL',
      lat: s.lat,
      lng: s.lng,
      label: 'Active SOS',
      weight: 0 // shown on the map, but never used to penalise a route
    });
  }

  return list;
}
