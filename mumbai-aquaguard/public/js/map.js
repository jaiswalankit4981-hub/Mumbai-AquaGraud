/* Leaflet map: hazard markers, route lines and the click-to-pin helper. */
const AquaMap = (() => {
  const MUMBAI = [19.076, 72.8777];
  const COLOURS = {
    NORMAL: '#35c27f',
    WARNING: '#f2b705',
    WATERLOGGED: '#f2760c',
    CRITICAL: '#e63946',
    UNKNOWN: '#8db2bc'
  };
  const SEVERITY_COLOUR = {
    LOW: COLOURS.NORMAL,
    MEDIUM: COLOURS.WARNING,
    HIGH: COLOURS.WATERLOGGED,
    CRITICAL: COLOURS.CRITICAL
  };

  let map;
  let hazardLayer;
  let locationLayer;
  let routeLayer;
  let pinLayer;

  function init(elementId) {
    map = L.map(elementId, { zoomControl: true }).setView(MUMBAI, 12);

    const streets = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Esri, HERE, Garmin, FAO, NOAA, USGS' }
    );

    const dark = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 16, attribution: 'Esri, HERE, Garmin, FAO, NOAA, USGS' }
    );

    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Esri, Maxar, Earthstar Geographics' }
    );

    const satelliteLabels = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, pane: 'shadowPane' }
    );

    dark.addTo(map);

    L.control
      .layers(
        {
          'Dark': dark,
          'Streets': streets,
          'Satellite': L.layerGroup([satellite, satelliteLabels])
        },
        {},
        { position: 'topright', collapsed: true }
      )
      .addTo(map);

    hazardLayer = L.layerGroup().addTo(map);
    locationLayer = L.layerGroup().addTo(map);
    routeLayer = L.layerGroup().addTo(map);
    pinLayer = L.layerGroup().addTo(map);
    return map;
  }

  const dot = (colour, size, pulse) =>
    L.divIcon({
      className: '',
      html: `<div class="marker-dot ${pulse ? 'marker-pulse' : ''}" style="width:${size}px;height:${size}px;background:${colour}"></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });

  function renderLocations(locations) {
    locationLayer.clearLayers();
    locations.forEach((l) => {
      const colour = COLOURS[l.waterStatus] || COLOURS.UNKNOWN;
      L.marker([l.lat, l.lng], { icon: dot(colour, 18, l.waterStatus === 'CRITICAL') })
        .bindPopup(locationPopup(l))
        .addTo(locationLayer);
    });
  }

  function locationPopup(l) {
    const trend = {
      RISING_FAST: 'Rising fast',
      RISING: 'Rising',
      STEADY: 'Steady',
      FALLING: 'Falling',
      UNKNOWN: 'Not enough data'
    }[l.trend];
    return `
      <h3>${l.name}</h3>
      <dl>
        <dt>Water</dt><dd>${l.waterDepth ?? 0} cm &middot; ${AquaAPI.titleCase(l.waterStatus)}</dd>
        <dt>Trend</dt><dd>${trend} (${l.rateOfRise ?? 0} cm/min)</dd>
        <dt>Rainfall</dt><dd>${l.rainfall ?? 0} mm</dd>
        <dt>Risk</dt><dd>${AquaAPI.titleCase(l.riskLevel)} &middot; ${l.riskScore}/100</dd>
        <dt>Ward</dt><dd>${l.ward || '—'}</dd>
        <dt>Updated</dt><dd>${l.lastReadingAt ? AquaAPI.timeAgo(l.lastReadingAt) : 'no reading yet'}</dd>
      </dl>`;
  }

  function renderHazards(hazards, allowedTypes) {
    hazardLayer.clearLayers();
    hazards
      .filter((h) => h.kind !== 'location')
      .filter((h) => !allowedTypes || h.kind === 'sos' || allowedTypes.has(h.type) || allowedTypes.has('OTHER'))
      .forEach((h) => {
        const isSos = h.kind === 'sos';
        const colour = isSos ? '#ff2d55' : SEVERITY_COLOUR[h.severity] || COLOURS.WARNING;
        L.marker([h.lat, h.lng], { icon: dot(colour, isSos ? 22 : 15, isSos || h.severity === 'CRITICAL') })
          .bindPopup(
            `<h3>${isSos ? 'SOS' : AquaAPI.titleCase(h.type)}</h3>
             <p>${h.label}</p>
             <dl><dt>Severity</dt><dd>${AquaAPI.titleCase(h.severity)}</dd></dl>`
          )
          .addTo(hazardLayer);
      });
  }

  function drawRoutes(routes, activeIndex = 0) {
    routeLayer.clearLayers();
    routes.forEach((r, i) => {
      const active = i === activeIndex;
      L.polyline(r.path, {
        color: active ? '#7fe3d4' : '#4a7f8c',
        weight: active ? 6 : 3,
        opacity: active ? 0.95 : 0.55
      }).addTo(routeLayer);
    });
    if (routes[activeIndex]) {
      map.fitBounds(L.polyline(routes[activeIndex].path).getBounds(), { padding: [40, 40] });
    }
  }

  function clearRoutes() {
    routeLayer.clearLayers();
  }

  function setPin(lat, lng, label) {
    pinLayer.clearLayers();
    L.marker([lat, lng]).bindPopup(label || 'Selected point').addTo(pinLayer);
    map.setView([lat, lng], Math.max(map.getZoom(), 15));
  }

  function onClick(handler) {
    map.on('click', (e) => handler(e.latlng.lat, e.latlng.lng));
  }

  return { init, renderLocations, renderHazards, drawRoutes, clearRoutes, setPin, onClick, COLOURS };
})();