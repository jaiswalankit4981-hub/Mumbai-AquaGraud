import dotenv from 'dotenv';
dotenv.config();

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));

export const env = {
  port: num(process.env.PORT, 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientOrigin: process.env.CLIENT_ORIGIN || '*',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/aquaguard',
  jwtSecret: process.env.JWT_SECRET || 'dev_secret_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  sensorApiKey: process.env.SENSOR_API_KEY || 'aquaguard-device-key-001',

  // FR-05 waterlogging classification thresholds (cm)
  waterWarningCm: num(process.env.WATER_WARNING_CM, 5),
  waterLoggedCm: num(process.env.WATER_LOGGED_CM, 15),
  waterCriticalCm: num(process.env.WATER_CRITICAL_CM, 30),

  // FR-06 trend
  rapidRiseCmPerMin: num(process.env.RAPID_RISE_CM_PER_MIN, 1.5),

  // FR-38 sensor health
  sensorOfflineMinutes: num(process.env.SENSOR_OFFLINE_MINUTES, 10),

  // FR-17 route hazard buffer
  hazardBufferM: num(process.env.HAZARD_BUFFER_M, 120),

  // FR-15 duplicate grouping
  duplicateRadiusM: num(process.env.DUPLICATE_RADIUS_M, 150),
  duplicateWindowHours: num(process.env.DUPLICATE_WINDOW_HOURS, 6),

  mqttEnabled: String(process.env.MQTT_ENABLED).toLowerCase() === 'true',
  mqttUrl: process.env.MQTT_URL || 'mqtt://broker.hivemq.com:1883',
  mqttTopic: process.env.MQTT_TOPIC || 'aquaguard/+/reading',

  osrmUrl: process.env.OSRM_URL || 'https://router.project-osrm.org'
};
