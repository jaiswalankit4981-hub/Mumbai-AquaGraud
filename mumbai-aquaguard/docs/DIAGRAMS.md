# Diagrams

Paste these Mermaid blocks into draw.io, Mermaid Live Editor (mermaid.live) or a
Markdown viewer, export as PNG, and drop them into the report.

## System architecture

```mermaid
flowchart TD
  WL[Water level sensor] --> ESP[ESP32 node]
  MH[Manhole reed/tilt sensor] --> ESP
  RN[Rain sensor] --> ESP
  ESP -->|HTTP or MQTT| API[Node.js + Express API]
  API --> DB[(MongoDB)]
  API --> RULE[Risk and rule engine]
  RULE --> ALERT[Alert service]
  ALERT --> WS[Socket.IO]
  WS --> WEB[Citizen web app]
  WS --> ADM[Admin dashboard]
  API --> OSRM[OSRM routing]
  WEB --> API
  ADM --> API
```

## Use case

```mermaid
flowchart LR
  C((Citizen)) --> UC1[View hazard map]
  C --> UC2[Find safer route]
  C --> UC3[Report a hazard]
  C --> UC4[Trigger SOS]
  C --> UC5[Receive alerts]
  A((Administrator)) --> UC6[Verify reports]
  A --> UC7[Monitor sensors]
  A --> UC8[Handle SOS]
  A --> UC9[Resolve incidents]
  A --> UC10[View analytics]
  D((IoT node)) --> UC11[Send readings]
  D --> UC12[Report device health]
```

## Data flow, level 0

```mermaid
flowchart LR
  S[IoT sensors] -->|readings| P((AquaGuard system))
  C[Citizen] -->|reports, SOS, route requests| P
  P -->|alerts, map, routes| C
  P -->|incidents, dashboards| A[Administrator]
  A -->|verification, thresholds| P
  P <-->|store and retrieve| DB[(Database)]
```

## Data flow, level 1

```mermaid
flowchart TD
  S[IoT node] --> P1[1.0 Ingest reading]
  P1 --> D1[(SensorReadings)]
  P1 --> P2[2.0 Classify and trend]
  P2 --> P3[3.0 Risk engine]
  P3 --> D2[(Locations)]
  P2 --> P4[4.0 Incident manager]
  P4 --> D3[(Incidents)]
  P4 --> P5[5.0 Alert service]
  P5 --> D4[(Alerts)]
  P5 --> C[Citizen and admin clients]
  C --> P6[6.0 Citizen reporting]
  P6 --> D5[(CitizenReports)]
  P6 --> P4
  C --> P7[7.0 Route planner]
  D3 --> P7
  C --> P8[8.0 SOS handler]
  P8 --> D6[(SOSAlerts)]
```

## Entity relationship

```mermaid
erDiagram
  USER ||--o{ CITIZENREPORT : files
  USER ||--o{ SOSALERT : raises
  USER ||--o{ ROUTEREQUEST : requests
  LOCATION ||--o{ SENSOR : hosts
  LOCATION ||--o{ MANHOLE : contains
  LOCATION ||--o{ INCIDENT : experiences
  LOCATION ||--o{ SENSORREADING : records
  SENSOR ||--o{ SENSORREADING : produces
  SENSOR |o--o| MANHOLE : monitors
  INCIDENT ||--o{ CITIZENREPORT : groups
  INCIDENT ||--o{ ALERT : triggers

  USER { string name string email string passwordHash string mobile string role }
  LOCATION { string name string ward float lat float lng int riskScore string waterStatus }
  SENSOR { string sensorId string sensorType string status int batteryLevel date lastSeen }
  SENSORREADING { float waterDepth float rainfall float temperature date timestamp }
  MANHOLE { string manholeId string coverStatus string status bool submerged }
  INCIDENT { string type string severity string status date startTime date endTime }
  CITIZENREPORT { string hazardType string severity string imageUrl string verificationStatus }
  SOSALERT { float lat float lng string category string status }
```

## Sequence: reading to alert

```mermaid
sequenceDiagram
  participant N as ESP32 node
  participant A as API
  participant R as Risk engine
  participant D as MongoDB
  participant U as Citizen app
  N->>A: POST /api/readings (x-api-key)
  A->>D: save SensorReading, update Sensor.lastSeen
  A->>R: classify depth, compute trend
  R->>D: update Location status and risk score
  alt depth >= waterlogged or rising fast
    A->>D: open or update Incident
    A->>D: save Alert
    A-->>U: socket alert:new
  else back to normal
    A->>D: resolve Incident
  end
  A-->>U: socket reading:new
```

## Sequence: SOS

```mermaid
sequenceDiagram
  participant C as Citizen
  participant A as API
  participant D as MongoDB
  participant K as Control room
  C->>C: press SOS, 5 second countdown
  C->>A: POST /api/sos with location
  A->>D: save SOSAlert (status ACTIVE)
  A->>A: notify emergency contacts
  A-->>K: socket sos:new
  K->>A: PUT /api/sos/:id/status ACKNOWLEDGED
  K->>A: ... ASSISTANCE_IN_PROGRESS -> RESOLVED
```

## Smart route decision

```mermaid
flowchart TD
  A[Start and destination] --> B[OSRM returns alternatives]
  B --> C[Load active hazards]
  C --> D{Hazard within 120 m of route?}
  D -- yes --> E[Add severity weight x proximity]
  D -- no --> F[Risk stays 0]
  E --> G[Route risk score]
  F --> G
  G --> H[Label fastest, safer, balanced]
  H --> I[Show warning for the worst hazard]
```
