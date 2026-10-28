# AquaGuard API reference

Base URL: `http://localhost:5000/api`
Auth: `Authorization: Bearer <token>` (from login/register).
Device ingestion uses `x-api-key: <SENSOR_API_KEY>` instead of a token.

## Auth
| Method | Path | Access | Purpose | SRS |
|---|---|---|---|---|
| POST | `/auth/register` | public | Create a citizen account | FR-01 |
| POST | `/auth/login` | public | Sign in, returns JWT | FR-02 |
| GET | `/auth/me` | user | Current profile | FR-02 |
| PUT | `/auth/contacts` | user | Save emergency contacts | FR-26 |

```json
POST /auth/register
{ "name": "Riya Shah", "email": "riya@example.com", "mobile": "9820011122", "password": "citizen123" }
```

## Sensor ingestion
| Method | Path | Access | Purpose | SRS |
|---|---|---|---|---|
| POST | `/readings` | device key | Submit a reading | FR-04 |
| GET | `/readings/:locationId?hours=6` | public | Reading history for charts | FR-06 |

```json
POST /readings          headers: { "x-api-key": "aquaguard-device-key-001" }
{ "sensorId": "S001", "waterDepth": 26.4, "rainfall": 38, "temperature": 29,
  "humidity": 88, "manholeCover": "CLOSED", "batteryLevel": 91, "status": "OK" }
```
One POST triggers the whole chain: store reading → classify depth (FR-05) → recompute
trend (FR-06) → open, update or resolve the incident → raise alerts (FR-07) →
recompute the risk score (FR-31) → push `reading:new` over WebSocket.

## Locations and map
| Method | Path | Access | Purpose | SRS |
|---|---|---|---|---|
| GET | `/locations` | public | All monitored points with status | FR-28 |
| GET | `/locations/nearby?lat=&lng=&radius=` | public | Hazards near the user | FR-03 |
| GET | `/locations/:id` | public | Detail, manholes, incidents, readings | FR-29 |
| POST | `/locations` | admin | Add a monitored point | 3.2 |
| PUT | `/locations/:id` | admin | Edit a monitored point | 3.2 |
| GET | `/map` | public | Combined hazard feed for the map | FR-28, FR-30 |
| GET | `/incidents?status=&type=&severity=` | public | Incident list | FR-30 |
| PUT | `/incidents/:id/resolve` | admin | Close an incident | 3.2 |
| GET | `/dashboard/summary` | admin | Dashboard counters | §16 |
| GET | `/alerts` | public | Recent alerts | FR-35 |

## Sensors
| Method | Path | Access | Purpose | SRS |
|---|---|---|---|---|
| GET | `/sensors` | admin | Status, battery, last seen | FR-37 |
| POST | `/sensors` | admin | Register a node | 3.2 |
| PUT | `/sensors/:sensorId` | admin | Edit type/status | 3.2 |
| POST | `/sensors/health-check` | admin | Run the offline sweep now | FR-38 |

## Manholes
| Method | Path | Access | Purpose | SRS |
|---|---|---|---|---|
| GET | `/manholes?status=OPEN` | public | Manhole list | FR-08 |
| POST | `/manholes` | admin | Register a manhole | FR-08 |
| PUT | `/manholes/:id` | admin | Change cover status, mark submerged | FR-09, FR-11 |

## Citizen reports
| Method | Path | Access | Purpose | SRS |
|---|---|---|---|---|
| POST | `/reports` | user | Report a hazard (multipart, field `image`) | FR-12, FR-13 |
| GET | `/reports?status=PENDING&mine=true` | user/admin | List reports | FR-14 |
| PUT | `/reports/:id/review` | admin | `{"action":"VERIFY\|REJECT\|RESOLVE"}` | FR-14 |

New reports within `DUPLICATE_RADIUS_M` of a matching open incident inside
`DUPLICATE_WINDOW_HOURS` are attached to it instead of creating a second one (FR-15).

## SOS
| Method | Path | Access | Purpose | SRS |
|---|---|---|---|---|
| POST | `/sos` | user | Raise an SOS (rate limited to 5/min) | FR-21 to FR-26 |
| GET | `/sos?status=ACTIVE` | user/admin | Citizens see their own, admins see all | FR-25 |
| PUT | `/sos/:id/status` | user/admin | Change status; citizens may only cancel their own | FR-27 |

## Smart routes
| Method | Path | Access | Purpose | SRS |
|---|---|---|---|---|
| POST | `/routes/plan` | optional | Fastest / safer / balanced options | FR-16 to FR-19 |
| POST | `/routes/recheck` | optional | Re-score a plotted route | FR-20 |

```json
POST /routes/plan
{ "start": { "lat": 19.0055, "lng": 72.8375 },
  "destination": { "lat": 19.118, "lng": 72.846 } }
```

## Analytics
| Method | Path | Access | Purpose | SRS |
|---|---|---|---|---|
| GET | `/analytics/overview` | public | Charts and statistics | FR-40 |
| GET | `/analytics/history?type=&from=&to=` | public | Resolved incident history | FR-39 |

## WebSocket events (socket.io)
Join `citizens` or `admins` after connecting.

| Event | Room | Payload |
|---|---|---|
| `reading:new` | all | `{ location, reading }` |
| `alert:new` | all / admins | Alert document |
| `incident:new`, `incident:resolved` | all | Incident document |
| `manhole:open`, `manhole:update` | all | Manhole document |
| `report:new` | admins | Report document |
| `sos:new`, `sos:update` | admins | SOS document |
| `sensor:offline` | admins | `{ sensorId }` |
