import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { protect, optionalAuth, adminOnly, deviceAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

import * as auth from '../controllers/authController.js';
import * as readings from '../controllers/readingController.js';
import * as locations from '../controllers/locationController.js';
import * as sensors from '../controllers/sensorController.js';
import * as manholes from '../controllers/manholeController.js';
import * as reports from '../controllers/reportController.js';
import * as sos from '../controllers/sosController.js';
import * as routing from '../controllers/routeController.js';
import * as incidents from '../controllers/incidentController.js';
import * as analytics from '../controllers/analyticsController.js';

const router = Router();

const authLimiter = rateLimit({ windowMs: 15 * 60000, max: 30 });
const sosLimiter = rateLimit({ windowMs: 60000, max: 5 });

// --- Auth (FR-01, FR-02, FR-26) ---
router.post('/auth/register', authLimiter, auth.register);
router.post('/auth/login', authLimiter, auth.login);
router.get('/auth/me', protect, auth.me);
router.put('/auth/contacts', protect, auth.updateContacts);

// --- Device ingestion (FR-04) ---
router.post('/readings', deviceAuth, readings.postReading);
router.get('/readings/:locationId', readings.readingHistory);

// --- Locations and map (FR-03, FR-28, FR-29, FR-30) ---
router.get('/locations', locations.listLocations);
router.get('/locations/nearby', locations.nearby);
router.get('/locations/:id', locations.locationDetail);
router.post('/locations', protect, adminOnly, locations.createLocation);
router.put('/locations/:id', protect, adminOnly, locations.updateLocation);

router.get('/map', optionalAuth, incidents.mapFeed);
router.get('/incidents', incidents.listIncidents);
router.put('/incidents/:id/resolve', protect, adminOnly, incidents.resolveIncident);
router.get('/dashboard/summary', protect, adminOnly, incidents.dashboardSummary);
router.get('/alerts', optionalAuth, incidents.listAlerts);

// --- Sensors (FR-37, FR-38) ---
router.get('/sensors', protect, adminOnly, sensors.listSensors);
router.post('/sensors', protect, adminOnly, sensors.createSensor);
router.put('/sensors/:sensorId', protect, adminOnly, sensors.updateSensor);
router.post('/sensors/health-check', protect, adminOnly, sensors.runHealthCheck);

// --- Manholes (FR-08 to FR-11) ---
router.get('/manholes', manholes.listManholes);
router.post('/manholes', protect, adminOnly, manholes.createManhole);
router.put('/manholes/:id', protect, adminOnly, manholes.updateManhole);

// --- Citizen reports (FR-12 to FR-15) ---
router.post('/reports', protect, upload.single('image'), reports.createReport);
router.get('/reports', protect, reports.listReports);
router.put('/reports/:id/review', protect, adminOnly, reports.reviewReport);

// --- SOS (FR-21 to FR-27) ---
router.post('/sos', protect, sosLimiter, sos.triggerSos);
router.get('/sos', protect, sos.listSos);
router.put('/sos/:id/status', protect, sos.updateSosStatus);

// --- Smart routes (FR-16 to FR-20) ---
router.post('/routes/plan', optionalAuth, routing.planRoute);
router.post('/routes/recheck', optionalAuth, routing.recheckRoute);

// --- Analytics (FR-39, FR-40) ---
router.get('/analytics/overview', analytics.analyticsOverview);
router.get('/analytics/history', analytics.incidentHistory);

router.get('/health', (_req, res) => res.json({ success: true, uptime: process.uptime() }));

export default router;
