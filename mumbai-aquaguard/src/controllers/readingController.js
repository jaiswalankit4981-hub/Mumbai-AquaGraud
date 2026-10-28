import Sensor from '../models/Sensor.js';
import SensorReading from '../models/SensorReading.js';
import Location from '../models/Location.js';
import Incident from '../models/Incident.js';
import Manhole from '../models/Manhole.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import { emit } from '../services/realtime.js';
import { raiseAlert } from '../services/alertService.js';
import {
  classifyWaterDepth,
  computeTrend,
  computeRiskScore,
  historicalIncidentCount,
  SEVERITY_BY_STATUS
} from '../services/riskEngine.js';

/**
 * FR-04: core ingestion routine, shared by the REST endpoint and the MQTT client.
 * payload: { sensorId, waterDepth, rainfall, temperature, humidity, manholeCover,
 *            batteryLevel, status, timestamp }
 */
export async function ingestReading(payload) {
  const { sensorId } = payload;
  if (!sensorId) throw new ApiError(400, 'sensorId is required.');

  const sensor = await Sensor.findOne({ sensorId });
  if (!sensor) throw new ApiError(404, `Sensor ${sensorId} is not registered.`);

  const reading = await SensorReading.create({
    sensorId,
    location: sensor.location,
    waterDepth: numeric(payload.waterDepth),
    rainfall: numeric(payload.rainfall),
    temperature: numeric(payload.temperature),
    humidity: numeric(payload.humidity),
    manholeCover: payload.manholeCover,
    batteryLevel: numeric(payload.batteryLevel),
    status: payload.status || 'OK',
    timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date()
  });

  sensor.status = 'ONLINE';
  sensor.lastSeen = reading.timestamp;
  if (reading.batteryLevel !== undefined && reading.batteryLevel !== null) {
    sensor.batteryLevel = reading.batteryLevel;
  }
  sensor.lastReading = {
    waterDepth: reading.waterDepth,
    rainfall: reading.rainfall,
    manholeCover: reading.manholeCover
  };
  await sensor.save();

  const location = await Location.findById(sensor.location);
  if (!location) return { reading };

  if (reading.waterDepth !== undefined && reading.waterDepth !== null) {
    await applyWaterReading(location, reading);
  }
  if (reading.manholeCover) {
    await applyManholeReading(sensor, location, reading);
  }
  if (reading.rainfall !== undefined && reading.rainfall !== null) {
    location.rainfall = reading.rainfall;
  }

  await refreshRisk(location);
  emit('reading:new', { location: location.toObject(), reading });

  return { reading, location };
}

function numeric(v) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** FR-05, FR-06, FR-07 */
async function applyWaterReading(location, reading) {
  const previousStatus = location.waterStatus;
  const status = classifyWaterDepth(reading.waterDepth);
  const { rateOfRise, trend } = await computeTrend(location._id);

  location.waterDepth = reading.waterDepth;
  location.waterStatus = status;
  location.rateOfRise = rateOfRise;
  location.trend = trend;
  location.lastReadingAt = reading.timestamp;

  const bad = status === 'WATERLOGGED' || status === 'CRITICAL';
  let incident = await Incident.findOne({
    location: location._id,
    type: 'WATERLOGGING',
    status: { $in: ['ACTIVE', 'MONITORING'] }
  });

  if (bad) {
    if (!incident) {
      incident = await Incident.create({
        location: location._id,
        lat: location.lat,
        lng: location.lng,
        type: 'WATERLOGGING',
        severity: SEVERITY_BY_STATUS[status],
        description: `${location.name}: water depth ${reading.waterDepth} cm`,
        source: 'SENSOR',
        maxWaterLevel: reading.waterDepth
      });
      emit('incident:new', incident);
    } else {
      incident.severity = SEVERITY_BY_STATUS[status];
      incident.maxWaterLevel = Math.max(incident.maxWaterLevel, reading.waterDepth);
      incident.description = `${location.name}: water depth ${reading.waterDepth} cm`;
      await incident.save();
    }

    if (status !== previousStatus) {
      await raiseAlert({
        type: 'WATERLOGGING',
        severity: status === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        title: `${status === 'CRITICAL' ? 'Severe' : ''} waterlogging at ${location.name}`.trim(),
        message: `Water depth is ${reading.waterDepth} cm and the status is ${status}.`,
        location: location._id,
        refId: String(incident._id)
      });
    }

    // FR-11: an open manhole under standing water is the highest-risk case.
    if (status === 'CRITICAL' || status === 'WATERLOGGED') {
      await Manhole.updateMany(
        { location: location._id, status: 'OPEN' },
        { $set: { submerged: true, riskLevel: 'CRITICAL' } }
      );
    }
  } else if (incident) {
    incident.status = 'RESOLVED';
    incident.endTime = new Date();
    incident.durationMinutes = Math.round((incident.endTime - incident.startTime) / 60000);
    await incident.save();
    await Manhole.updateMany({ location: location._id }, { $set: { submerged: false } });
    emit('incident:resolved', incident);
  }

  // FR-07: fast rise is an alert on its own, even below the critical depth.
  if (trend === 'RISING_FAST' && location.trend !== 'RISING_FAST') {
    await raiseAlert({
      type: 'RAPID_RISE',
      severity: 'CRITICAL',
      title: `Water rising fast at ${location.name}`,
      message: `Rising at about ${rateOfRise} cm per minute. Currently ${reading.waterDepth} cm.`,
      location: location._id
    });
  }
}

/** FR-08, FR-10 */
async function applyManholeReading(sensor, location, reading) {
  const manhole = await Manhole.findOne({ sensorId: sensor.sensorId });
  if (!manhole) return;

  const open = reading.manholeCover === 'OPEN' || reading.manholeCover === 'DISPLACED';
  const changed = manhole.coverStatus !== reading.manholeCover;

  manhole.coverStatus = reading.manholeCover;
  manhole.status = open ? 'OPEN' : 'SAFE';
  manhole.riskLevel = open ? (manhole.submerged ? 'CRITICAL' : 'HIGH') : 'LOW';
  manhole.lastChecked = reading.timestamp;
  await manhole.save();

  if (open && changed) {
    const incident = await Incident.create({
      location: location._id,
      lat: manhole.lat,
      lng: manhole.lng,
      type: 'OPEN_MANHOLE',
      severity: manhole.submerged ? 'CRITICAL' : 'HIGH',
      description: `${manhole.manholeId} cover reported ${reading.manholeCover.toLowerCase()}`,
      source: 'SENSOR'
    });
    await raiseAlert({
      type: 'OPEN_MANHOLE',
      severity: 'CRITICAL',
      title: `Open manhole near ${location.name}`,
      message: `${manhole.manholeId} is ${reading.manholeCover.toLowerCase()}. Avoid the area.`,
      location: location._id,
      refId: String(incident._id)
    });
    emit('manhole:open', manhole);
  }
}

/** FR-31: recompute and store the location risk score. */
export async function refreshRisk(location) {
  const [history, openManholes, roadHazards] = await Promise.all([
    historicalIncidentCount(location._id),
    Manhole.countDocuments({ location: location._id, status: 'OPEN' }),
    Incident.countDocuments({
      location: location._id,
      status: 'ACTIVE',
      type: { $in: ['ROAD_BLOCKAGE', 'FALLEN_OBJECT', 'DRAINAGE_ISSUE'] }
    })
  ]);

  const risk = computeRiskScore({
    waterDepth: location.waterDepth,
    rateOfRise: location.rateOfRise,
    rainfall: location.rainfall,
    historicalIncidents: history,
    openManholes,
    roadHazards
  });

  location.riskScore = risk.score;
  location.riskLevel = risk.category;
  await location.save();
  return risk;
}

/** POST /api/readings  (device authenticated) */
export const postReading = asyncHandler(async (req, res) => {
  const result = await ingestReading(req.body);
  res.status(201).json({ success: true, reading: result.reading });
});

/** GET /api/readings/:locationId?hours=6 */
export const readingHistory = asyncHandler(async (req, res) => {
  const hours = Math.min(Number(req.query.hours) || 6, 168);
  const since = new Date(Date.now() - hours * 3600000);
  const readings = await SensorReading.find({
    location: req.params.locationId,
    timestamp: { $gte: since }
  })
    .sort({ timestamp: 1 })
    .lean();
  res.json({ success: true, count: readings.length, readings });
});
