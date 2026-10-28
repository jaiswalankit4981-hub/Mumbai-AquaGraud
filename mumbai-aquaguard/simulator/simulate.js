/**
 * Stands in for the ESP32 nodes during development and demos.
 * Sends readings for every registered sensor, drives one location through a
 * flood curve, and pops a manhole open partway through.
 *
 *   npm run simulate                 # default: 5 second interval
 *   node simulator/simulate.js --interval 2000 --flood S001
 */
import dotenv from 'dotenv';
dotenv.config();

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};

const BASE = arg('url', `http://localhost:${process.env.PORT || 5000}`);
const KEY = process.env.SENSOR_API_KEY || 'aquaguard-device-key-001';
const INTERVAL = Number(arg('interval', 5000));
const FLOOD_SENSOR = arg('flood', 'S001');
const SENSORS = arg('sensors', 'S001,S002,S003,S004,S005').split(',');

const state = Object.fromEntries(SENSORS.map((s) => [s, { depth: 2, step: 0 }]));

async function send(sensorId, body) {
  try {
    const res = await fetch(`${BASE}/api/readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': KEY },
      body: JSON.stringify({ sensorId, ...body })
    });
    const data = await res.json();
    if (!data.success) console.error(`  ${sensorId} rejected: ${data.message}`);
  } catch (e) {
    console.error(`  ${sensorId} failed: ${e.message}`);
  }
}

async function tick() {
  for (const sensorId of SENSORS) {
    const s = state[sensorId];
    s.step += 1;

    if (sensorId === FLOOD_SENSOR) {
      // 0 -> ~40 cm over about 20 ticks, then it recedes.
      s.depth = s.step < 20 ? s.depth + 2 + Math.random() : Math.max(0, s.depth - 3);
    } else {
      s.depth = Math.max(0, s.depth + (Math.random() - 0.5) * 2);
    }

    const payload = {
      waterDepth: Math.round(s.depth * 10) / 10,
      rainfall: Math.round(10 + Math.random() * 40),
      temperature: 27 + Math.round(Math.random() * 3),
      humidity: 80 + Math.round(Math.random() * 15),
      batteryLevel: 95 - Math.floor(s.step / 20),
      manholeCover: sensorId === FLOOD_SENSOR && s.step === 8 ? 'OPEN' : 'CLOSED'
    };

    console.log(`-> ${sensorId} ${payload.waterDepth} cm${payload.manholeCover === 'OPEN' ? '  [manhole opened]' : ''}`);
    await send(sensorId, payload);
  }
  console.log('');
}

console.log(`Simulating ${SENSORS.length} nodes against ${BASE} every ${INTERVAL} ms`);
console.log(`Flood curve on ${FLOOD_SENSOR}. Ctrl+C to stop.\n`);
tick();
setInterval(tick, INTERVAL);
