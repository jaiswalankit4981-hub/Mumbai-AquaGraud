import mongoose from 'mongoose';

const routeRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    start: { lat: Number, lng: Number, label: String },
    destination: { lat: Number, lng: Number, label: String },
    routeType: { type: String, enum: ['FASTEST', 'SAFER', 'BALANCED'], default: 'BALANCED' },
    hazardsFound: { type: Number, default: 0 },
    chosenRiskScore: Number
  },
  { timestamps: true }
);

export default mongoose.model('RouteRequest', routeRequestSchema);
