/**
 * Seeds the prototype dataset: two accounts, five monitored locations in Mumbai,
 * their sensors and manholes, and three months of history so the analytics
 * screen has something to draw.
 *
 *   npm run seed
 */
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import Location from '../src/models/Location.js';
import Sensor from '../src/models/Sensor.js';
import Manhole from '../src/models/Manhole.js';
import Incident from '../src/models/Incident.js';
import SensorReading from '../src/models/SensorReading.js';

const LOCATIONS = [
  { name: 'Hindmata Junction, Dadar', ward: 'F/North', lat: 19.0055, lng: 72.8375 },
  { name: 'Milan Subway, Santacruz', ward: 'H/West', lat: 19.079, lng: 72.84 },
  { name: 'Andheri Subway', ward: 'K/West', lat: 19.118, lng: 72.846 },
  { name: 'Sion Circle', ward: 'F/North', lat: 19.04, lng: 72.862 },
  { name: 'Kurla Depot Road', ward: 'L', lat: 19.07, lng: 72.879 },
  { name: 'Gandhi Market, King Circle', ward: 'F/North', lat: 19.028, lng: 72.856 },
  { name: 'Malad Subway', ward: 'P/North', lat: 19.187, lng: 72.842 },
  { name: 'Parel ST Depot', ward: 'F/South', lat: 19.011, lng: 72.833 },
  { name: 'Vikhroli Godrej Junction', ward: 'S', lat: 19.108, lng: 72.928 },
  { name: 'Chembur Naka', ward: 'M/West', lat: 19.062, lng: 72.9 }
];

async function run() {
  await connectDB();
  console.log('[seed] clearing old prototype data');
  await Promise.all([
    User.deleteMany({}),
    Location.deleteMany({}),
    Sensor.deleteMany({}),
    Manhole.deleteMany({}),
    Incident.deleteMany({}),
    SensorReading.deleteMany({})
  ]);

  const admin = new User({
    name: 'Control Room',
    email: 'admin@aquaguard.in',
    mobile: '9820000000',
    role: 'admin'
  });
  await admin.setPassword('admin123');
  await admin.save();

  const citizen = new User({
    name: 'Riya Shah',
    email: 'riya@example.com',
    mobile: '9820011122',
    role: 'citizen',
    emergencyContacts: [{ name: 'Papa', mobile: '9820033344' }]
  });
  await citizen.setPassword('citizen123');
  await citizen.save();

  const locations = await Location.insertMany(LOCATIONS);
  console.log(`[seed] ${locations.length} locations`);

  let n = 1;
  for (const loc of locations) {
    const id = String(n).padStart(3, '0');
    await Sensor.create({
      sensorId: `S${id}`,
      sensorType: 'MULTI',
      location: loc._id,
      lat: loc.lat,
      lng: loc.lng,
      status: 'ONLINE',
      lastSeen: new Date(),
      batteryLevel: 80 + Math.round(Math.random() * 20)
    });
    await Manhole.create({
      manholeId: `MH-${id}`,
      location: loc._id,
      sensorId: `S${id}`,
      lat: loc.lat + 0.0012,
      lng: loc.lng + 0.0009,
      coverStatus: 'CLOSED',
      status: 'SAFE'
    });
    n++;
  }
  console.log('[seed] sensors and manholes created');

  // Historical incidents across the last three monsoon months (FR-39, FR-40).
  const history = [];
  for (let month = 0; month < 3; month++) {
    for (const loc of locations) {
      const count = 1 + Math.floor(Math.random() * 4);
      for (let i = 0; i < count; i++) {
        const start = new Date();
        start.setMonth(start.getMonth() - month);
        start.setDate(1 + Math.floor(Math.random() * 27));
        const duration = 40 + Math.floor(Math.random() * 200);
        history.push({
          location: loc._id,
          lat: loc.lat,
          lng: loc.lng,
          type: Math.random() > 0.2 ? 'WATERLOGGING' : 'OPEN_MANHOLE',
          severity: ['MEDIUM', 'HIGH', 'CRITICAL'][Math.floor(Math.random() * 3)],
          description: `${loc.name}: historical record`,
          source: 'SENSOR',
          status: 'RESOLVED',
          maxWaterLevel: 12 + Math.floor(Math.random() * 40),
          startTime: start,
          endTime: new Date(start.getTime() + duration * 60000),
          durationMinutes: duration
        });
      }
    }
  }
  await Incident.insertMany(history);
  console.log(`[seed] ${history.length} historical incidents`);

  // A day of readings per location so the charts are not empty.
  const readings = [];
  for (const loc of locations) {
    let depth = 2;
    for (let i = 24 * 6; i > 0; i--) {
      depth = Math.max(0, depth + (Math.random() - 0.45) * 3);
      readings.push({
        sensorId: `S${String(locations.indexOf(loc) + 1).padStart(3, '0')}`,
        location: loc._id,
        waterDepth: Math.round(depth * 10) / 10,
        rainfall: Math.round(Math.random() * 25),
        temperature: 27 + Math.round(Math.random() * 4),
        humidity: 75 + Math.round(Math.random() * 20),
        timestamp: new Date(Date.now() - i * 10 * 60000)
      });
    }
  }
  await SensorReading.insertMany(readings);
  console.log(`[seed] ${readings.length} readings`);

  console.log('\nAccounts');
  console.log('  admin   : admin@aquaguard.in / admin123');
  console.log('  citizen : riya@example.com  / citizen123');

  await mongoose.disconnect();
}

run().catch((e) => {
  console.error('[seed] failed:', e);
  process.exit(1);
});
