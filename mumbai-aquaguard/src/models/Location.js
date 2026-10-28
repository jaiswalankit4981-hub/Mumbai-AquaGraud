import mongoose from 'mongoose';

/** A monitored point in the city (junction, underpass, low-lying road). */
const locationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    ward: { type: String },           // BMC ward, e.g. "G/South"
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'LOW' },
    riskScore: { type: Number, default: 0 },
    waterDepth: { type: Number, default: 0 },      // last known depth (cm)
    waterStatus: {
      type: String,
      enum: ['NORMAL', 'WARNING', 'WATERLOGGED', 'CRITICAL', 'UNKNOWN'],
      default: 'UNKNOWN'
    },
    trend: { type: String, enum: ['RISING_FAST', 'RISING', 'STEADY', 'FALLING', 'UNKNOWN'], default: 'UNKNOWN' },
    rateOfRise: { type: Number, default: 0 },      // cm per minute
    rainfall: { type: Number, default: 0 },        // mm in last hour
    lastReadingAt: { type: Date },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

locationSchema.index({ lat: 1, lng: 1 });

export default mongoose.model('Location', locationSchema);
