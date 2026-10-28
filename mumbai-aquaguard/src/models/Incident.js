import mongoose from 'mongoose';

/** An active or historical hazard at a location (FR-39). */
const incidentSchema = new mongoose.Schema(
  {
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    lat: Number,
    lng: Number,
    type: {
      type: String,
      enum: ['WATERLOGGING', 'OPEN_MANHOLE', 'ROAD_BLOCKAGE', 'DRAINAGE_ISSUE', 'FALLEN_OBJECT', 'OTHER'],
      required: true
    },
    severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
    description: String,
    source: { type: String, enum: ['SENSOR', 'CITIZEN', 'ADMIN'], default: 'SENSOR' },
    status: { type: String, enum: ['ACTIVE', 'MONITORING', 'RESOLVED'], default: 'ACTIVE' },
    maxWaterLevel: { type: Number, default: 0 },
    reportCount: { type: Number, default: 0 },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    durationMinutes: { type: Number }
  },
  { timestamps: true }
);

incidentSchema.index({ status: 1, type: 1 });

export default mongoose.model('Incident', incidentSchema);
