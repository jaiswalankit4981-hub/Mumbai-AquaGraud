import mongoose from 'mongoose';

const manholeSchema = new mongoose.Schema(
  {
    manholeId: { type: String, required: true, unique: true }, // e.g. "MH-014"
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    sensorId: { type: String },
    coverStatus: {
      type: String,
      enum: ['CLOSED', 'OPEN', 'DISPLACED', 'UNKNOWN'],
      default: 'CLOSED'
    },
    // FR-09
    status: {
      type: String,
      enum: ['SAFE', 'OPEN', 'UNKNOWN', 'UNDER_INSPECTION', 'RESOLVED'],
      default: 'SAFE'
    },
    submerged: { type: Boolean, default: false },   // FR-11: hidden by water
    riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'LOW' },
    lastChecked: { type: Date, default: Date.now },
    notes: String
  },
  { timestamps: true }
);

export default mongoose.model('Manhole', manholeSchema);
