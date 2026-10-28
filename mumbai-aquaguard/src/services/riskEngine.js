import { env } from '../config/env.js';
import SensorReading from '../models/SensorReading.js';
import Incident from '../models/Incident.js';

/** FR-05: map a water depth in cm onto a configurable status band. */
export function classifyWaterDepth(cm) {
  if (cm === null || cm === undefined || Number.isNaN(cm)) return 'UNKNOWN';
  if (cm < env.waterWarningCm) return 'NORMAL';
  if (cm < env.waterLoggedCm) return 'WARNING';
  if (cm < env.waterCriticalCm) return 'WATERLOGGED';
  return 'CRITICAL';
}

export const SEVERITY_BY_STATUS = {
  NORMAL: 'LOW',
  WARNING: 'MEDIUM',
  WATERLOGGED: 'HIGH',
  CRITICAL: 'CRITICAL',
  UNKNOWN: 'LOW'
};

/**
 * FR-06: rate of rise in cm/min from the recent reading history.
 * Uses a simple least-squares slope so one noisy sample cannot flip the trend.
 */
export async function computeTrend(locationId, windowMinutes = 20) {
  const since = new Date(Date.now() - windowMinutes * 60000);
  const readings = await SensorReading.find({
    location: locationId,
    waterDepth: { $ne: null },
    timestamp: { $gte: since }
  })
    .sort({ timestamp: 1 })
    .lean();

  if (readings.length < 2) return { rateOfRise: 0, trend: 'UNKNOWN' };

  const t0 = readings[0].timestamp.getTime();
  const xs = readings.map((r) => (r.timestamp.getTime() - t0) / 60000); // minutes
  const ys = readings.map((r) => r.waterDepth);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den; // cm per minute
  const rate = Math.round(slope * 100) / 100;

  let trend = 'STEADY';
  if (rate >= env.rapidRiseCmPerMin) trend = 'RISING_FAST';
  else if (rate > 0.2) trend = 'RISING';
  else if (rate < -0.2) trend = 'FALLING';

  return { rateOfRise: rate, trend };
}

/**
 * FR-31: prototype risk score (0-100) combining live and historical signals.
 * Weights are intentionally simple and explainable for the project report.
 */
export function computeRiskScore({
  waterDepth = 0,
  rateOfRise = 0,
  rainfall = 0,
  historicalIncidents = 0,
  openManholes = 0,
  roadHazards = 0
}) {
  const depthScore = Math.min(waterDepth / env.waterCriticalCm, 1) * 35;
  const riseScore = Math.min(Math.max(rateOfRise, 0) / (env.rapidRiseCmPerMin * 2), 1) * 20;
  const rainScore = Math.min(rainfall / 60, 1) * 15;          // 60 mm/h == full weight
  const historyScore = Math.min(historicalIncidents / 10, 1) * 10;
  const manholeScore = Math.min(openManholes / 3, 1) * 12;
  const hazardScore = Math.min(roadHazards / 3, 1) * 8;

  const total = Math.round(
    depthScore + riseScore + rainScore + historyScore + manholeScore + hazardScore
  );

  return {
    score: total,
    category: categorise(total),
    breakdown: {
      waterLevel: Math.round(depthScore),
      rateOfRise: Math.round(riseScore),
      rainfall: Math.round(rainScore),
      history: Math.round(historyScore),
      openManholes: Math.round(manholeScore),
      roadHazards: Math.round(hazardScore)
    }
  };
}

/** FR-32 */
export function categorise(score) {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}

/** Counts incidents at a location over the past N days, used as the history input. */
export async function historicalIncidentCount(locationId, days = 90) {
  const since = new Date(Date.now() - days * 86400000);
  return Incident.countDocuments({ location: locationId, startTime: { $gte: since } });
}
