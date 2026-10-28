import mqtt from 'mqtt';
import { env } from '../config/env.js';
import { ingestReading } from '../controllers/readingController.js';

/**
 * Optional MQTT ingestion path (section 21). Devices publish JSON to
 * aquaguard/<sensorId>/reading; the payload is identical to the REST body.
 */
export function startMqtt() {
  if (!env.mqttEnabled) return null;
  const client = mqtt.connect(env.mqttUrl);

  client.on('connect', () => {
    client.subscribe(env.mqttTopic, (err) => {
      if (err) console.error('[mqtt] subscribe failed', err.message);
      else console.log(`[mqtt] listening on ${env.mqttTopic}`);
    });
  });

  client.on('message', async (topic, buf) => {
    try {
      const payload = JSON.parse(buf.toString());
      if (!payload.sensorId) payload.sensorId = topic.split('/')[1];
      await ingestReading(payload);
    } catch (e) {
      console.error('[mqtt] bad payload', e.message);
    }
  });

  client.on('error', (e) => console.error('[mqtt]', e.message));
  return client;
}
