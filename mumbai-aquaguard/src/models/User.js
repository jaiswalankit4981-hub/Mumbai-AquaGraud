import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const emergencyContactSchema = new mongoose.Schema(
  { name: String, mobile: String, email: String },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    mobile: { type: String, trim: true },
    role: { type: String, enum: ['citizen', 'admin'], default: 'citizen' },
    emergencyContacts: [emergencyContactSchema], // FR-26
    homeLocation: { lat: Number, lng: Number, label: String }
  },
  { timestamps: true }
);

userSchema.methods.setPassword = async function (plain) {
  this.passwordHash = await bcrypt.hash(plain, 10);
};

userSchema.methods.verifyPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    mobile: this.mobile,
    role: this.role,
    emergencyContacts: this.emergencyContacts
  };
};

export default mongoose.model('User', userSchema);
