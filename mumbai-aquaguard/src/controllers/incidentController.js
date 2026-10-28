import Incident from '../models/Incident.js';
import Location from '../models/Location.js';
import Manhole from '../models/Manhole.js';
import SOSAlert from '../models/SOSAlert.js';
import CitizenReport from '../models/CitizenReport.js';
import Sensor from '../models/Sensor.js';
import Alert from '../models/Alert.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import { activeHazards } from '../services/hazardService.js';
import { emit } from '../services/realtime.js';

/** FR-28, FR-30: everything the map draws, in one call. */
export const mapFeed = asyncHandler(async (req, res) => {
  const includeSos = req.user?.role === 'admin';
  const [hazards, locations] = await Promise.all([
    activeHazards({ includeSos }),
    Location.find({ active: true }).lean()
  ]);
  res.json({ success: true, hazards, locations });
});

export const listIncidents = asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.status) query.status = req.query.status;
  if (req.query.type) query.type = req.query.type;
  if (req.query.severity) query.severity = req.query.severity;
  const incidents = await Incident.find(query)
    .populate('location', 'name ward')
    .sort({ startTime: -1 })
    .limit(300)
    .lean();
  res.json({ success: true, count: incidents.length, incidents });
});

export const resolveIncident = asyncHandler(async (req, res) => {
  const incident = await Incident.findById(req.params.id);
  if (!incident) throw new ApiError(404, 'Incident not found.');
  incident.status = 'RESOLVED';
  incident.endTime = new Date();
  incident.durationMinutes = Math.round((incident.endTime - incident.startTime) / 60000);
  await incident.save();
  emit('incident:resolved', incident);
  res.json({ success: true, incident });
});

/** Section 16: dashboard counters. */
export const dashboardSummary = asyncHandler(async (_req, res) => {
  const [
    totalSensors,
    onlineSensors,
    activeIncidents,
    criticalLocations,
    openManholes,
    waterloggedRoads,
    pendingReports,
    activeSos
  ] = await Promise.all([
    Sensor.countDocuments(),
    Sensor.countDocuments({ status: 'ONLINE' }),
    Incident.countDocuments({ status: { $in: ['ACTIVE', 'MONITORING'] } }),
    Location.countDocuments({ riskLevel: 'CRITICAL' }),
    Manhole.countDocuments({ status: 'OPEN' }),
    Location.countDocuments({ waterStatus: { $in: ['WATERLOGGED', 'CRITICAL'] } }),
    CitizenReport.countDocuments({ verificationStatus: 'PENDING' }),
    SOSAlert.countDocuments({ status: { $in: ['ACTIVE', 'ACKNOWLEDGED', 'ASSISTANCE_IN_PROGRESS'] } })
  ]);

  res.json({
    success: true,
    summary: {
      totalSensors,
      onlineSensors,
      offlineSensors: totalSensors - onlineSensors,
      activeIncidents,
      criticalLocations,
      openManholes,
      waterloggedRoads,
      pendingReports,
      activeSos
    }
  });
});

export const listAlerts = asyncHandler(async (req, res) => {
  const query = req.user?.role === 'admin' ? {} : { audience: 'ALL' };
  const alerts = await Alert.find(query).sort({ createdAt: -1 }).limit(50).lean();
  res.json({ success: true, alerts });
});
