import Manhole from '../models/Manhole.js';
import Incident from '../models/Incident.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import { raiseAlert } from '../services/alertService.js';
import { emit } from '../services/realtime.js';

export const listManholes = asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.status) query.status = req.query.status;
  const manholes = await Manhole.find(query).populate('location', 'name ward').lean();
  res.json({ success: true, count: manholes.length, manholes });
});

export const createManhole = asyncHandler(async (req, res) => {
  const { manholeId, lat, lng, locationId, sensorId } = req.body;
  if (!manholeId || lat === undefined || lng === undefined) {
    throw new ApiError(400, 'manholeId, latitude and longitude are required.');
  }
  const manhole = await Manhole.create({ manholeId, lat, lng, location: locationId, sensorId });
  res.status(201).json({ success: true, manhole });
});

/** FR-09, FR-10, FR-11 */
export const updateManhole = asyncHandler(async (req, res) => {
  const manhole = await Manhole.findById(req.params.id);
  if (!manhole) throw new ApiError(404, 'Manhole not found.');

  const wasOpen = manhole.status === 'OPEN';
  ['status', 'coverStatus', 'submerged', 'notes'].forEach((f) => {
    if (req.body[f] !== undefined) manhole[f] = req.body[f];
  });
  manhole.riskLevel =
    manhole.status === 'OPEN' ? (manhole.submerged ? 'CRITICAL' : 'HIGH') : 'LOW';
  manhole.lastChecked = new Date();
  await manhole.save();

  if (!wasOpen && manhole.status === 'OPEN') {
    await Incident.create({
      location: manhole.location,
      lat: manhole.lat,
      lng: manhole.lng,
      type: 'OPEN_MANHOLE',
      severity: manhole.submerged ? 'CRITICAL' : 'HIGH',
      description: `${manhole.manholeId} marked open by an administrator`,
      source: 'ADMIN'
    });
    await raiseAlert({
      type: 'OPEN_MANHOLE',
      severity: 'CRITICAL',
      title: `Open manhole: ${manhole.manholeId}`,
      message: manhole.submerged
        ? 'The manhole is open and hidden by standing water. Avoid this stretch.'
        : 'The cover is open or displaced. Avoid this stretch.',
      location: manhole.location,
      refId: String(manhole._id)
    });
  }

  emit('manhole:update', manhole);
  res.json({ success: true, manhole });
});
