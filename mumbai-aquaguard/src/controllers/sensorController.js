import Sensor from '../models/Sensor.js';
import Location from '../models/Location.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import { env } from '../config/env.js';
import { checkSensorHealth } from '../services/sensorHealth.js';

/** FR-37 */
export const listSensors = asyncHandler(async (_req, res) => {
  const sensors = await Sensor.find().populate('location', 'name ward').lean();
  const cutoff = Date.now() - env.sensorOfflineMinutes * 60000;
  const decorated = sensors.map((s) => ({
    ...s,
    healthy: s.lastSeen ? new Date(s.lastSeen).getTime() > cutoff : false,
    minutesSinceLastSeen: s.lastSeen
      ? Math.round((Date.now() - new Date(s.lastSeen).getTime()) / 60000)
      : null
  }));
  res.json({ success: true, count: decorated.length, sensors: decorated });
});

export const createSensor = asyncHandler(async (req, res) => {
  const { sensorId, sensorType, locationId } = req.body;
  if (!sensorId || !locationId) throw new ApiError(400, 'sensorId and locationId are required.');
  const location = await Location.findById(locationId);
  if (!location) throw new ApiError(404, 'Location not found.');
  if (await Sensor.findOne({ sensorId })) throw new ApiError(409, 'That sensor ID is already registered.');

  const sensor = await Sensor.create({
    sensorId,
    sensorType: sensorType || 'WATER_LEVEL',
    location: location._id,
    lat: location.lat,
    lng: location.lng
  });
  res.status(201).json({ success: true, sensor });
});

export const updateSensor = asyncHandler(async (req, res) => {
  const sensor = await Sensor.findOne({ sensorId: req.params.sensorId });
  if (!sensor) throw new ApiError(404, 'Sensor not found.');
  ['sensorType', 'status', 'firmware'].forEach((f) => {
    if (req.body[f] !== undefined) sensor[f] = req.body[f];
  });
  await sensor.save();
  res.json({ success: true, sensor });
});

export const runHealthCheck = asyncHandler(async (_req, res) => {
  const flagged = await checkSensorHealth();
  res.json({ success: true, flagged });
});
