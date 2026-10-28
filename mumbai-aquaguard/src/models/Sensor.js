import mongoose from 'mongoose';

const sensorSchema = new mongoose.Schema(
  {
    sensorId: { type: String, required: true, unique: true }, // e.g. "S001"
    sensorType: {
      type: String,
      enum: ['WATER_LEVEL', 'MANHOLE', 'RAIN', 'MULTI'],
      default: 'WATER_LEVEL'
    },
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
    lat: Number,
    lng: Number,
    status: { type: String, enum: ['ONLINE', 'OFFLINE', 'MAINTENANCE'], default: 'OFFLINE' },
    batteryLevel: { type: Number, default: 100 },
    firmware: { type: String, default: 'v1.0' },
    lastSeen: { type: Date },
    lastReading: { type: mongoose.Schema.Types.Mixed }
  },
  { timestamps: true }
);

export default mongoose.model('Sensor', sensorSchema);
