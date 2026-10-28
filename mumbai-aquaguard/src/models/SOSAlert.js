import mongoose from 'mongoose';

const sosSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracy: Number,
    category: {
      type: String,
      enum: ['FLOOD', 'TRAPPED', 'MEDICAL', 'FALL_INTO_MANHOLE', 'VEHICLE_STUCK', 'OTHER'],
      default: 'OTHER'
    },
    message: String,
    device: String,
    // FR-27
    status: {
      type: String,
      enum: ['ACTIVE', 'ACKNOWLEDGED', 'ASSISTANCE_IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
      default: 'ACTIVE'
    },
    contactsNotified: [{ name: String, channel: String, target: String, sentAt: Date }],
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
    notes: String
  },
  { timestamps: true }
);

export default mongoose.model('SOSAlert', sosSchema);
