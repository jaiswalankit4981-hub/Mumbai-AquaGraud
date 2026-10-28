import Sensor from '../models/Sensor.js';
import { env } from '../config/env.js';
import { raiseAlert } from './alertService.js';
import { emit } from './realtime.js';

/**
 * FR-38: flag sensors that have stopped reporting.
 * Missing data is marked OFFLINE rather than treated as a normal reading (NFR 19.2).
 */
export async function checkSensorHealth() {
  const cutoff = new Date(Date.now() - env.sensorOfflineMinutes * 60000);
  const stale = await Sensor.find({
    status: 'ONLINE',
    $or: [{ lastSeen: { $lt: cutoff } }, { lastSeen: null }]
  });

  for (const sensor of stale) {
    sensor.status = 'OFFLINE';
    await sensor.save();
    await raiseAlert({
      type: 'SENSOR_OFFLINE',
      severity: 'WARNING',
      title: `Sensor ${sensor.sensorId} is offline`,
      message: `No data received for over ${env.sensorOfflineMinutes} minutes.`,
      location: sensor.location,
      refId: sensor.sensorId,
      audience: 'ADMIN'
    });
    emit('sensor:offline', { sensorId: sensor.sensorId }, 'admins');
  }
  return stale.length;
}

export function startSensorHealthMonitor(intervalMs = 60000) {
  setInterval(() => {
    checkSensorHealth().catch((e) => console.error('[sensorHealth]', e.message));
  }, intervalMs);
}
