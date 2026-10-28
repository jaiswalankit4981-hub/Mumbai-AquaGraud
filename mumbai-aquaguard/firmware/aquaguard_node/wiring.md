# ESP32 node wiring

| Component | Part used in the prototype | ESP32 pin | Notes |
|---|---|---|---|
| Water level | JSN-SR04T (waterproof) or HC-SR04 | TRIG 5, ECHO 18 | ECHO is 5 V. Use a 1 kΩ / 2 kΩ divider into GPIO 18. |
| Manhole cover | Reed switch + magnet on the cover | 19 | `INPUT_PULLUP`; magnet near switch = cover closed. |
| Manhole cover (option B) | SW-520D tilt switch on the cover | 19 | Same logic; tilt = displaced. |
| Manhole cover (option C) | Second ultrasonic aimed into the shaft | 25 / 26 | Distance jump = cover removed. |
| Rainfall | YL-83 / FC-37 rain board | AO → 34 | ADC1 pin; do not use ADC2 pins while WiFi is on. |
| Temp / humidity | DHT11 | 4 | 10 kΩ pull-up between DATA and 3V3. |
| Buzzer | Active buzzer | 23 | |
| Indicator | Red LED + 220 Ω | 22 | |
| Power | 5 V 2 A supply or 18650 + TP4056 | VIN / GND | Keep the sensor ground common. |

Mount the ultrasonic sensor a fixed height above the road and set
`SENSOR_HEIGHT_CM` to that height. Depth = mounting height − measured distance.

Calibration: place a ruler in the tray, fill to 5, 10, 20 and 30 cm and record
what the node reports. Adjust `SENSOR_HEIGHT_CM` until the numbers line up, and
note the readings in the test document — this is the calibration evidence
examiners usually ask for.
