import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

import { env } from './src/config/env.js';
import { connectDB } from './src/config/db.js';
import apiRoutes from './src/routes/index.js';
import { notFound, errorHandler } from './src/middleware/errorHandler.js';
import { initRealtime } from './src/services/realtime.js';
import { startSensorHealthMonitor } from './src/services/sensorHealth.js';
import { startMqtt } from './src/services/mqttClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = http.createServer(app);

app.use(
  helmet({
    contentSecurityPolicy: false, // the map loads tiles and Leaflet from CDNs
    crossOriginEmbedderPolicy: false
  })
);
app.use(cors({ origin: env.clientOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.use('/api', apiRoutes);
app.use(express.static(path.join(__dirname, 'public')));

app.use(notFound);
app.use(errorHandler);

async function start() {
  await connectDB();
  initRealtime(server);
  startSensorHealthMonitor();
  startMqtt();
  server.listen(env.port, () => {
    console.log(`[server] AquaGuard running on http://localhost:${env.port}`);
  });
}

start().catch((e) => {
  console.error('[server] failed to start:', e.message);
  process.exit(1);
});
