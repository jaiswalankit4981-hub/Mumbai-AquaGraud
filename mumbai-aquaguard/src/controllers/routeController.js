import RouteRequest from '../models/RouteRequest.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import { findRoutes } from '../services/routeService.js';

/** FR-16 to FR-20 */
export const planRoute = asyncHandler(async (req, res) => {
  const { start, destination } = req.body;
  if (!start?.lat || !start?.lng || !destination?.lat || !destination?.lng) {
    throw new ApiError(400, 'Set both a starting point and a destination.');
  }

  const routes = await findRoutes(start, destination);
  const safer = routes.find((r) => r.type.includes('SAFER')) || routes[0];

  if (req.user) {
    await RouteRequest.create({
      user: req.user._id,
      start,
      destination,
      routeType: 'BALANCED',
      hazardsFound: safer.hazards.length,
      chosenRiskScore: safer.riskScore
    });
  }

  res.json({ success: true, routes, recommended: safer.type });
});

/** FR-20: re-check a route the user is already following. */
export const recheckRoute = asyncHandler(async (req, res) => {
  const { start, destination, currentRiskScore } = req.body;
  const routes = await findRoutes(start, destination);
  const best = routes.reduce((a, b) => (b.riskScore < a.riskScore ? b : a), routes[0]);
  res.json({
    success: true,
    routes,
    shouldReroute: currentRiskScore !== undefined && best.riskScore < Number(currentRiskScore),
    recommended: best.type
  });
});
