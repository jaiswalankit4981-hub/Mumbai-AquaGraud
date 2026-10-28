import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../models/User.js';
import { ApiError } from '../utils/asyncHandler.js';

export function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn
  });
}

/** Requires a valid JWT (FR-02). */
export async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new ApiError(401, 'Sign in to continue.');
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.id);
    if (!user) throw new ApiError(401, 'This account no longer exists.');
    req.user = user;
    next();
  } catch (err) {
    next(err instanceof ApiError ? err : new ApiError(401, 'Session expired. Sign in again.'));
  }
}

/** Attaches the user when a token is present, but does not block anonymous use. */
export async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return next();
  try {
    const payload = jwt.verify(header.slice(7), env.jwtSecret);
    req.user = await User.findById(payload.id);
  } catch {
    /* ignore invalid token for public endpoints */
  }
  next();
}

/** Restricts administrative functions (NFR 19.4). */
export function adminOnly(req, _res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return next(new ApiError(403, 'Administrator access is required for this action.'));
  }
  next();
}

/** Validates the device key sent by ESP32 nodes (FR-04). */
export function deviceAuth(req, _res, next) {
  const key = req.headers['x-api-key'];
  if (key !== env.sensorApiKey) {
    return next(new ApiError(401, 'Invalid device key.'));
  }
  next();
}
