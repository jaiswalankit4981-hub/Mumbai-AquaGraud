import Location from '../models/Location.js';
import Manhole from '../models/Manhole.js';
import Incident from '../models/Incident.js';
import SensorReading from '../models/SensorReading.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import { haversine } from '../utils/geo.js';
import { refreshRisk } from './readingController.js';

export const listLocations = asyncHandler(async (req, res) => {
  const query = { active: true };
  if (req.query.ward) query.ward = req.query.ward;
  const locations = await Location.find(query).sort({ riskScore: -1 }).lean();
  res.json({ success: true, count: locations.length, locations });
});

/** FR-29: everything shown when a marker is opened. */
export const locationDetail = asyncHandler(async (req, res) => {
  const location = await Location.findById(req.params.id).lean();
  if (!location) throw new ApiError(404, 'Location not found.');

  const [manholes, incidents, lastReadings] = await Promise.all([
    Manhole.find({ location: location._id }).lean(),
    Incident.find({ location: location._id }).sort({ startTime: -1 }).limit(10).lean(),
    SensorReading.find({ location: location._id }).sort({ timestamp: -1 }).limit(30).lean()
  ]);

  res.json({
    success: true,
    location,
    manholes,
    incidents,
    readings: lastReadings.reverse()
  });
});

/** FR-03: hazards near the citizen's current position. */
export const nearby = asyncHandler(async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radius = Number(req.query.radius) || 3000;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new ApiError(400, 'Provide lat and lng values.');
  }

  const [locations, manholes] = await Promise.all([
    Location.find({ active: true }).lean(),
    Manhole.find({ status: { $in: ['OPEN', 'UNDER_INSPECTION'] } }).lean()
  ]);

  const withDistance = (arr) =>
    arr
      .map((x) => ({ ...x, distance: Math.round(haversine(lat, lng, x.lat, x.lng)) }))
      .filter((x) => x.distance <= radius)
      .sort((a, b) => a.distance - b.distance);

  res.json({
    success: true,
    locations: withDistance(locations),
    manholes: withDistance(manholes)
  });
});

export const createLocation = asyncHandler(async (req, res) => {
  const { name, ward, lat, lng } = req.body;
  if (!name || lat === undefined || lng === undefined) {
    throw new ApiError(400, 'Name, latitude and longitude are required.');
  }
  const location = await Location.create({ name, ward, lat, lng });
  res.status(201).json({ success: true, location });
});

export const updateLocation = asyncHandler(async (req, res) => {
  const location = await Location.findById(req.params.id);
  if (!location) throw new ApiError(404, 'Location not found.');
  const fields = ['name', 'ward', 'lat', 'lng', 'active'];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) location[f] = req.body[f];
  });
  await location.save();
  await refreshRisk(location);
  res.json({ success: true, location });
});
