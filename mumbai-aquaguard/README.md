# Mumbai AquaGuard

IoT-based urban flood, open-manhole detection and smart emergency response system.
Full-stack prototype: ESP32 nodes → Node.js/Express API → MongoDB → live Leaflet map,
hazard-aware routing, citizen reporting and an SOS channel to a control room.

Built against the project SRS. Every module below maps to its FR numbers so the
code can be cited directly in the report.

---

## Run it

Prerequisites: Node 18 or newer, MongoDB running locally (or a free Atlas cluster).

```bash
npm install
cp .env.example .env          # edit JWT_SECRET and MONGO_URI
npm run seed                  # 5 Mumbai locations, sensors, manholes, 3 months of history
npm start                     # http://localhost:5000
```

In a second terminal, stand in for the hardware:

```bash
npm run simulate              # drives S001 through a flood curve and pops a manhole open
```

Accounts created by the seed:

| Role | Email | Password |
|---|---|---|
| Citizen | riya@example.com | citizen123 |
| Control room | admin@aquaguard.in | admin123 |

Admins are created only by the seed script — the public registration endpoint always
creates citizens, so nobody can self-promote.

### Connecting the real ESP32
1. Open `firmware/aquaguard_node/aquaguard_node.ino` in the Arduino IDE.
2. Install the ESP32 board package plus the ArduinoJson and DHT libraries.
3. Set `WIFI_SSID`, `WIFI_PASSWORD`, `SERVER_URL` (your laptop's LAN IP, not localhost),
   `API_KEY` (must match `SENSOR_API_KEY` in `.env`) and `SENSOR_ID` (`S001`…`S005`).
4. Measure the mounting height of the ultrasonic sensor and set `SENSOR_HEIGHT_CM`.
5. Flash, open the serial monitor at 115200, and watch the map update.

Wiring table: `firmware/aquaguard_node/wiring.md`.

---

## File structure

```
mumbai-aquaguard/
├── server.js                    Express + Socket.IO entry point
├── package.json  .env.example  .gitignore
├── src/
│   ├── config/
│   │   ├── env.js               every threshold, read from .env (FR-05, FR-06, FR-38)
│   │   └── db.js                MongoDB connection
│   ├── models/                  9 Mongoose schemas = SRS section 22
│   │   ├── User.js  Location.js  Sensor.js  SensorReading.js
│   │   ├── Incident.js  Manhole.js  CitizenReport.js
│   │   └── SOSAlert.js  Alert.js  RouteRequest.js
│   ├── middleware/
│   │   ├── auth.js              JWT, role guard, device API key (FR-02, 19.4)
│   │   ├── upload.js            report photos, 5 MB, images only (FR-13)
│   │   └── errorHandler.js
│   ├── services/
│   │   ├── riskEngine.js        depth classification, trend slope, risk score (FR-05, 06, 31, 32)
│   │   ├── alertService.js      alert records + contact notification (FR-35, FR-26)
│   │   ├── hazardService.js     one normalised hazard list for map and routing
│   │   ├── routeService.js      OSRM alternatives scored against hazards (FR-16 to FR-20)
│   │   ├── sensorHealth.js      offline sweep every 60 s (FR-38)
│   │   ├── realtime.js          Socket.IO rooms
│   │   └── mqttClient.js        optional MQTT ingestion
│   ├── controllers/             10 controllers, one per module in SRS section 4
│   ├── routes/index.js          34 endpoints, each tagged with its FR
│   └── utils/                   haversine, point-to-polyline distance, async wrapper
├── public/
│   ├── index.html               citizen: map, filters, routes, report, SOS
│   ├── admin.html               control room dashboard + analytics
│   ├── login.html               sign in / register
│   ├── css/style.css
│   └── js/  api.js  auth.js  map.js  citizen.js  admin.js
├── firmware/aquaguard_node/
│   ├── aquaguard_node.ino       ESP32 sketch
│   └── wiring.md                pin map and calibration notes
├── seed/seed.js                 demo dataset
├── simulator/simulate.js        virtual sensor nodes
└── docs/
    ├── API.md                   endpoint reference
    ├── DIAGRAMS.md              architecture, use case, DFD 0/1, ER, sequence (Mermaid)
    ├── TEST-PLAN.md             39 test cases + hardware calibration
    └── DOCUMENTATION-CHECKLIST.md   every document to submit
```

---

## How the pieces fit

One reading drives everything:

```
ESP32 --POST /api/readings--> save reading, mark sensor online
        -> classify depth        NORMAL / WARNING / WATERLOGGED / CRITICAL   FR-05
        -> least-squares slope over 20 min -> cm/min, RISING_FAST            FR-06
        -> open / update / resolve the Incident                              FR-39
        -> raise alerts on band change or fast rise                          FR-07
        -> mark open manholes submerged when water is deep                   FR-11
        -> recompute the location risk score 0-100                           FR-31
        -> push reading:new and alert:new over WebSocket                     FR-35
```

**Risk score weights** (`src/services/riskEngine.js`): water depth 35, rate of rise 20,
rainfall 15, open manholes 12, historical incidents 10, road hazards 8. Bands: 0–24 low,
25–49 medium, 50–74 high, 75+ critical. The weights are deliberately simple so you can
defend every number in the viva.

**Safer routing** (`src/services/routeService.js`): OSRM returns two or three
alternatives, each hazard within 120 m of a route adds `severity weight × proximity`,
and the three strategies are labelled from the resulting scores. If one geometry wins
two strategies the labels merge instead of showing the same line twice.

**Duplicate reports** (FR-15): a new report within 150 m of a matching open incident in
the last 6 hours is attached to it and the incident's report count goes up, so ten people
reporting one flooded junction produce one dashboard row.

**Missing data** (NFR 19.2): a silent sensor flips to OFFLINE and raises an admin alert.
The last known depth stays on the map with its age, so a dead sensor never reads as 0 cm.

---

## Demo script for the viva

1. Start the server with the map on screen. Everything green.
2. Pour water into the tray. Watch the marker go amber, then orange, then red, and the
   alert feed fill in. Point at the cm/min figure while it is still rising.
3. Lift the manhole cover off the magnet. The manhole alert fires and the marker turns red.
4. Plan a route through that junction. Show the fastest option carrying the warning and
   the safer option going around.
5. Press SOS on a phone. Switch to the control room screen — the row is already there.
   Acknowledge it, then resolve it.
6. Unplug the node. After the offline window, show the sensor health alert.
7. Finish on the analytics page.

Keep `npm run simulate` ready as a backup in case the hardware sulks.

---

## Known limitations
Selected locations only, not city-wide coverage. Thresholds are prototype values and
need real calibration. Citizen reports need verification. Routing quality depends on
OSRM and OpenStreetMap data. The SOS channel alerts this system's control room — it is
not a replacement for 100, 101 or 108, and the UI says so.
