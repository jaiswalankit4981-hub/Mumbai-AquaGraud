import mongoose from 'mongoose';

/** Notification records produced by the rule engine (FR-35). */
const alertSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'WATERLOGGING', 'RAPID_RISE', 'OPEN_MANHOLE', 'ROAD_HAZARD',
        'SOS', 'SENSOR_OFFLINE', 'REPORT_VERIFIED'
      ],
      required: true
    },
    severity: { type: String, enum: ['INFO', 'WARNING', 'CRITICAL'], default: 'INFO' },
    title: String,
    message: String,
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    refId: String,
    audience: { type: String, enum: ['ALL', 'ADMIN'], default: 'ALL' },
    read: { type: Boolean, default: false }
  },
  { timestamps: true }
);

alertSchema.index({ createdAt: -1 });

export default mongoose.model('Alert', alertSchema);
