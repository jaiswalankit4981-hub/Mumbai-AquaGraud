import SOSAlert from '../models/SOSAlert.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import { raiseAlert, notifyContacts } from '../services/alertService.js';
import { emit } from '../services/realtime.js';

/** FR-21 to FR-26 */
export const triggerSos = asyncHandler(async (req, res) => {
  const { lat, lng, accuracy, category, message } = req.body;
  if (lat === undefined || lng === undefined) {
    throw new ApiError(400, 'Share your location so responders can find you.');
  }

  const sos = await SOSAlert.create({
    user: req.user._id,
    lat: Number(lat),
    lng: Number(lng),
    accuracy,
    category: category || 'OTHER',
    message,
    device: req.headers['user-agent']
  });

  sos.contactsNotified = await notifyContacts(req.user, sos);
  await sos.save();

  await raiseAlert({
    type: 'SOS',
    severity: 'CRITICAL',
    title: `SOS from ${req.user.name}`,
    message: message || 'Emergency assistance requested.',
    refId: String(sos._id),
    audience: 'ADMIN'
  });

  const populated = await sos.populate('user', 'name mobile email');
  emit('sos:new', populated, 'admins');

  res.status(201).json({
    success: true,
    sos: populated,
    message:
      'SOS sent. Contact the official emergency services on 100 or 108 as well — AquaGuard alerts the control room, it does not replace them.'
  });
});

export const listSos = asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.status) query.status = req.query.status;
  if (req.user.role !== 'admin') query.user = req.user._id;
  const alerts = await SOSAlert.find(query)
    .populate('user', 'name mobile email')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  res.json({ success: true, count: alerts.length, sos: alerts });
});

/** FR-27 */
export const updateSosStatus = asyncHandler(async (req, res) => {
  const { status, notes } = req.body;
  const allowed = ['ACTIVE', 'ACKNOWLEDGED', 'ASSISTANCE_IN_PROGRESS', 'RESOLVED', 'CANCELLED'];
  if (!allowed.includes(status)) throw new ApiError(400, 'Unknown SOS status.');

  const sos = await SOSAlert.findById(req.params.id);
  if (!sos) throw new ApiError(404, 'SOS alert not found.');

  // A citizen may cancel their own alert; everything else is control-room work.
  const isOwner = String(sos.user) === String(req.user._id);
  if (req.user.role !== 'admin' && !(isOwner && status === 'CANCELLED')) {
    throw new ApiError(403, 'Only the control room can change this alert.');
  }

  sos.status = status;
  if (notes) sos.notes = notes;
  if (req.user.role === 'admin') sos.handledBy = req.user._id;
  if (status === 'RESOLVED' || status === 'CANCELLED') sos.resolvedAt = new Date();
  await sos.save();

  emit('sos:update', sos, 'admins');
  res.json({ success: true, sos });
});
