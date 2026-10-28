# Test plan

Environment: Chrome on a laptop, Node 18+, MongoDB running locally, one ESP32 node
or `npm run simulate` standing in for it.

## Unit and integration cases

| ID | Requirement | Steps | Expected result | Result |
|---|---|---|---|---|
| T-01 | FR-01 | Register with a duplicate email | Rejected with "account already exists" | |
| T-02 | FR-01 | Register with a 4-character password | Rejected, minimum 6 characters | |
| T-03 | FR-02 | Login with a wrong password | 401, no token issued | |
| T-04 | FR-02 | Call `/api/sensors` without a token | 401 | |
| T-05 | FR-02 | Call `/api/sensors` with a citizen token | 403 | |
| T-06 | FR-04 | POST a reading without `x-api-key` | 401 | |
| T-07 | FR-04 | POST a reading for an unknown sensorId | 404 | |
| T-08 | FR-05 | Post 3, 9, 20 and 45 cm | Status NORMAL, WARNING, WATERLOGGED, CRITICAL | |
| T-09 | FR-05 | Change `WATER_LOGGED_CM` to 10 and restart | New band applies without code changes | |
| T-10 | FR-06 | Post 10 → 15 → 22 → 30 cm one minute apart | Trend RISING_FAST, rate about 6.6 cm/min | |
| T-11 | FR-07 | Cross 30 cm | Critical alert appears on both screens within 2 s | |
| T-12 | FR-08 | Lift the magnet off the reed switch | Cover reads OPEN at the next transmission | |
| T-13 | FR-10 | Same as T-12 | Manhole alert raised, marker turns red | |
| T-14 | FR-11 | Set water CRITICAL at a location with an open manhole | Manhole marked submerged, risk CRITICAL | |
| T-15 | FR-12 | Submit a report with a photo | Stored, photo visible to the admin | |
| T-16 | FR-15 | Submit two identical reports 50 m apart | Second one grouped, `grouped: true` | |
| T-17 | FR-14 | Verify a report | Incident created, appears on the map | |
| T-18 | FR-14 | Reject a report | Status REJECTED, no incident created | |
| T-19 | FR-16 | Plan Dadar → Andheri | Routes returned with distance and time | |
| T-20 | FR-17 | Create a critical hazard on the direct road, replan | Safer route avoids it, lower risk score | |
| T-21 | FR-18 | Same plan | Three labelled options, duplicates merged | |
| T-22 | FR-19 | Choose a route through a hazard | Warning text names the hazard | |
| T-23 | FR-20 | Raise a new incident on a plotted route | Client re-checks and offers a safer route | |
| T-24 | FR-21 | Press SOS | Confirmation dialog with countdown | |
| T-25 | FR-22 | Press cancel during the countdown | No SOS record created | |
| T-26 | FR-23 | Allow location, send SOS | Coordinates stored within GPS accuracy | |
| T-27 | FR-25 | Send SOS with the admin screen open | Row appears without refreshing | |
| T-28 | FR-26 | SOS with two saved contacts | Both notification attempts logged | |
| T-29 | FR-27 | Move through acknowledged → resolved | Status updates and timestamps recorded | |
| T-30 | FR-28 | Open the map | Markers match the seeded data | |
| T-31 | FR-30 | Untick "open manholes" | Those markers disappear | |
| T-32 | FR-31 | 26 cm, 2 cm/min, 40 mm rain, 1 open manhole | Score 64, category HIGH | |
| T-33 | FR-37 | Open sensor health | Battery and last-seen shown per node | |
| T-34 | FR-38 | Unplug a node for 10 minutes | Status flips to offline, alert raised | |
| T-35 | NFR 19.2 | Stop the node mid-demo | Last value retained and marked stale, not zero | |
| T-36 | FR-40 | Open analytics | All three charts render from seeded history | |
| T-37 | NFR 19.1 | 5 nodes at 2 s intervals | Map updates stay under about 2 s | |
| T-38 | NFR 19.4 | Inspect the users collection | Only bcrypt hashes stored | |
| T-39 | NFR 19.6 | Open on a 360 px phone viewport | Map and SOS button usable | |

## Hardware calibration

| ID | Step | Expected |
|---|---|---|
| H-01 | Dry tray | Depth reads 0 ± 1 cm |
| H-02 | Fill to 5, 10, 20, 30 cm against a ruler | Reported depth within ± 2 cm |
| H-03 | Ripple the surface by hand | Median filter keeps the value stable |
| H-04 | Magnet on the cover | CLOSED |
| H-05 | Slide the cover aside | OPEN at the next cycle |
| H-06 | Drop the WiFi | Node retries and resumes without a reset |

## How to record results
Fill the Result column with Pass or Fail, add the tester's name and date, and keep
one screenshot per failed case. Examiners usually want the failures and the fix,
not only a column of ticks.
