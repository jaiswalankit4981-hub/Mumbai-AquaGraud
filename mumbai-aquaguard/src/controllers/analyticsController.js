import Incident from '../models/Incident.js';
import SensorReading from '../models/SensorReading.js';
import CitizenReport from '../models/CitizenReport.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/** FR-40: charts and statistics for the analytics screen. */
export const analyticsOverview = asyncHandler(async (_req, res) => {
  const [byMonth, byLocation, byType, durations, reports, rainfallVsWater] = await Promise.all([
    Incident.aggregate([
      { $match: { type: 'WATERLOGGING' } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$startTime' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    Incident.aggregate([
      { $group: { _id: '$location', count: { $sum: 1 }, maxWater: { $max: '$maxWaterLevel' } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'locations', localField: '_id', foreignField: '_id', as: 'loc' } },
      { $unwind: { path: '$loc', preserveNullAndEmptyArrays: true } },
      { $project: { name: '$loc.name', ward: '$loc.ward', count: 1, maxWater: 1 } }
    ]),
    Incident.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Incident.aggregate([
      { $match: { status: 'RESOLVED', durationMinutes: { $ne: null } } },
      { $group: { _id: null, avg: { $avg: '$durationMinutes' }, max: { $max: '$durationMinutes' } } }
    ]),
    CitizenReport.aggregate([{ $group: { _id: '$verificationStatus', count: { $sum: 1 } } }]),
    SensorReading.aggregate([
      { $match: { rainfall: { $ne: null }, waterDepth: { $ne: null } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d %H:00', date: '$timestamp' } },
          rainfall: { $avg: '$rainfall' },
          waterDepth: { $avg: '$waterDepth' }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 72 }
    ])
  ]);

  res.json({
    success: true,
    analytics: {
      waterloggingByMonth: byMonth,
      mostAffectedLocations: byLocation,
      hazardsByType: byType,
      incidentDuration: durations[0] || { avg: 0, max: 0 },
      reportsByStatus: reports,
      rainfallVsWaterlogging: rainfallVsWater
    }
  });
});

/** FR-39: filterable incident history. */
export const incidentHistory = asyncHandler(async (req, res) => {
  const query = { status: 'RESOLVED' };
  if (req.query.type) query.type = req.query.type;
  if (req.query.from || req.query.to) {
    query.startTime = {};
    if (req.query.from) query.startTime.$gte = new Date(req.query.from);
    if (req.query.to) query.startTime.$lte = new Date(req.query.to);
  }
  const incidents = await Incident.find(query)
    .populate('location', 'name ward')
    .sort({ startTime: -1 })
    .limit(500)
    .lean();
  res.json({ success: true, count: incidents.length, incidents });
});
