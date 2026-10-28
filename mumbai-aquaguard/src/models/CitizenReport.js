import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    hazardType: {
      type: String,
      enum: ['WATERLOGGING', 'OPEN_MANHOLE', 'ROAD_BLOCKAGE', 'DRAINAGE_ISSUE', 'FALLEN_OBJECT', 'OTHER'],
      required: true
    },
    severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
    description: String,
    imageUrl: String,
    verificationStatus: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'REJECTED', 'DUPLICATE'],
      default: 'PENDING'
    },
    incident: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident' }, // FR-15 grouping
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date
  },
  { timestamps: true }
);

export default mongoose.model('CitizenReport', reportSchema);
