import Alert from '../models/Alert.js';
import { emit } from './realtime.js';

/**
 * FR-35: persist an alert and push it to connected clients.
 * Notification channels (FR-36) are pluggable: add email/SMS senders here.
 */
export async function raiseAlert({
  type,
  severity = 'WARNING',
  title,
  message,
  location = null,
  refId = null,
  audience = 'ALL'
}) {
  const alert = await Alert.create({ type, severity, title, message, location, refId, audience });
  emit('alert:new', alert, audience === 'ADMIN' ? 'admins' : undefined);
  console.log(`[alert] ${severity} ${type} :: ${title}`);
  return alert;
}

/**
 * FR-26 / FR-36: notify a user's registered emergency contacts.
 * The prototype logs the message; swap in Twilio, SMTP or FCM here.
 */
export async function notifyContacts(user, sos) {
  const contacts = user?.emergencyContacts || [];
  const link = `https://maps.google.com/?q=${sos.lat},${sos.lng}`;
  const body = `AquaGuard SOS from ${user.name}. Location: ${link}. ${sos.message || ''}`.trim();
  const sent = [];
  for (const c of contacts) {
    const channel = c.mobile ? 'SMS' : 'EMAIL';
    const target = c.mobile || c.email;
    if (!target) continue;
    console.log(`[notify:${channel}] -> ${target} :: ${body}`);
    sent.push({ name: c.name, channel, target, sentAt: new Date() });
  }
  return sent;
}
