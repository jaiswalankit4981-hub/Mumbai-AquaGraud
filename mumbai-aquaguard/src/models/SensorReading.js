import mongoose from 'mongoose';

const readingSchema = new mongoose.Schema(
  {
    sensorId: { type: String, required: true, index: true },
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', index: true },
    waterDepth: { type: Number },     // cm
    rainfall: { type: Number },       // mm
    temperature: { type: Number },    // deg C
    humidity: { type: Number },       // %
    manholeCover: { type: String, enum: ['CLOSED', 'OPEN', 'DISPLACED', 'UNKNOWN'] },
    batteryLevel: { type: Number },
    status: { type: String, default: 'OK' },
    timestamp: { type: Date, default: Date.now, index: true }
  },
  { versionKey: false }
);

readingSchema.index({ location: 1, timestamp: -1 });

export default mongoose.model('SensorReading', readingSchema);
