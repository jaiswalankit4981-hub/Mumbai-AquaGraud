import User from '../models/User.js';
import { signToken } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** FR-01 */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, mobile, role } = req.body;

  if (!name || !email || !password) throw new ApiError(400, 'Name, email and password are required.');
  if (!EMAIL.test(email)) throw new ApiError(400, 'Enter a valid email address.');
  if (password.length < 6) throw new ApiError(400, 'Use a password of at least 6 characters.');
  if (mobile && !/^[0-9+\-\s]{10,15}$/.test(mobile)) throw new ApiError(400, 'Enter a valid mobile number.');
  if (await User.findOne({ email: email.toLowerCase() })) {
    throw new ApiError(409, 'An account with this email already exists.');
  }

  const user = new User({
    name,
    email,
    mobile,
    role: role === 'admin' ? 'citizen' : 'citizen' // admins are created by seeding only
  });
  await user.setPassword(password);
  await user.save();

  res.status(201).json({ success: true, token: signToken(user), user: user.toSafeJSON() });
});

/** FR-02 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, 'Enter your email and password.');

  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+passwordHash');
  if (!user || !(await user.verifyPassword(password))) {
    throw new ApiError(401, 'Email or password is incorrect.');
  }
  res.json({ success: true, token: signToken(user), user: user.toSafeJSON() });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user.toSafeJSON() });
});

/** FR-26 */
export const updateContacts = asyncHandler(async (req, res) => {
  const contacts = Array.isArray(req.body.emergencyContacts) ? req.body.emergencyContacts : [];
  req.user.emergencyContacts = contacts.slice(0, 5);
  await req.user.save();
  res.json({ success: true, user: req.user.toSafeJSON() });
});
