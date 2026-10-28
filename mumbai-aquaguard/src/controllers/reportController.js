import CitizenReport from '../models/CitizenReport.js';
import Incident from '../models/Incident.js';
import Location from '../models/Location.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import { haversine } from '../utils/geo.js';
import { env } from '../config/env.js';
import { raiseAlert } from '../services/alertService.js';
import { emit } from '../services/realtime.js';

/** FR-12, FR-13, FR-15 */
export const createReport = asyncHandler(async (req, res) => {
  const { hazardType, severity, description, lat, lng } = req.body;
  if (!hazardType || lat === undefined || lng === undefined) {
    throw new ApiError(400, 'Choose a hazard type and share a location.');
  }

  const report = await CitizenReport.create({
    user: req.user._id,
    hazardType,
    severity: severity || 'MEDIUM',
    description,
    lat: Number(lat),
    lng: Number(lng),
    imageUrl: req.file ? `/uploads/${req.file.filename}` : undefined,
    location: await nearestLocationId(Number(lat), Number(lng))
  });

  const duplicateOf = await findDuplicate(report);
  if (duplicateOf) {
    report.incident = duplicateOf._id;
    report.verificationStatus = 'DUPLICATE';
    await report.save();
    duplicateOf.reportCount += 1;
    await duplicateOf.save();
  }

  emit('report:new', report, 'admins');
  res.status(201).json({
    success: true,
    report,
    grouped: Boolean(duplicateOf),
    message: duplicateOf
      ? 'Thanks. Others reported this too, so we added your report to the existing incident.'
      : 'Thanks. Your report is queued for verification.'
  });
});

async function nearestLocationId(lat, lng) {
  const locations = await Location.find({ active: true }).lean();
  let best = null;
  let bestD = Infinity;
  for (const l of locations) {
    const d = haversine(lat, lng, l.lat, l.lng);
    if (d < bestD) {
      bestD = d;
      best = l;
    }
  }
  return bestD <= 1500 ? best?._id : undefined;
}

/** Groups reports of the same hazard near the same spot into one incident. */
async function findDuplicate(report) {
  const since = new Date(Date.now() - env.duplicateWindowHours * 3600000);
  const candidates = await Incident.find({
    type: report.hazardType,
    status: { $in: ['ACTIVE', 'MONITORING'] },
    startTime: { $gte: since }
  });
  return candidates.find(
    (i) => haversine(report.lat, report.lng, i.lat, i.lng) <= env.duplicateRadiusM
  );
}

export const listReports = asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.status) query.verificationStatus = req.query.status;
  if (req.query.mine === 'true') query.user = req.user._id;
  const reports = await CitizenReport.find(query)
    .populate('user', 'name mobile')
    .populate('location', 'name ward')
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  res.json({ success: true, count: reports.length, reports });
});

/** FR-14: verify, reject, re-grade or resolve a citizen report. */
export const reviewReport = asyncHandler(async (req, res) => {
  const { action, severity } = req.body;
  const report = await CitizenReport.findById(req.params.id);
  if (!report) throw new ApiError(404, 'Report not found.');
  if (severity) report.severity = severity;

  if (action === 'VERIFY') {
    report.verificationStatus = 'VERIFIED';
    if (!report.incident) {
      const incident = await Incident.create({
        location: report.location,
        lat: report.lat,
        lng: report.lng,
        type: report.hazardType,
        severity: report.severity,
        description: report.description || 'Verified citizen report',
        source: 'CITIZEN',
        reportCount: 1
      });
      report.incident = incident._id;
      emit('incident:new', incident);
      await raiseAlert({
        type: report.hazardType === 'OPEN_MANHOLE' ? 'OPEN_MANHOLE' : 'ROAD_HAZARD',
        severity: report.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        title: `Verified hazard: ${report.hazardType.replace(/_/g, ' ').toLowerCase()}`,
        message: report.description || 'A citizen report has been verified by the control room.',
        location: report.location,
        refId: String(report._id)
      });
    }
  } else if (action === 'REJECT') {
    report.verificationStatus = 'REJECTED';
  } else if (action === 'RESOLVE') {
    report.verificationStatus = 'VERIFIED';
    if (report.incident) {
      const incident = await Incident.findById(report.incident);
      if (incident && incident.status !== 'RESOLVED') {
        incident.status = 'RESOLVED';
        incident.endTime = new Date();
        incident.durationMinutes = Math.round((incident.endTime - incident.startTime) / 60000);
        await incident.save();
        emit('incident:resolved', incident);
      }
    }
  } else {
    throw new ApiError(400, 'Action must be VERIFY, REJECT or RESOLVE.');
  }

  report.reviewedBy = req.user._id;
  report.reviewedAt = new Date();
  await report.save();
  res.json({ success: true, report });
});
