/* Citizen screen: live map, alerts, safe routes, hazard reports and SOS. */
(() => {
  const user = AquaAPI.requireAuth();
  if (!user) return;

  if (user.role === 'admin') document.getElementById('nav-admin').hidden = false;
  document.getElementById('nav-signout').addEventListener('click', (e) => {
    e.preventDefault();
    AquaAPI.clearSession();
    location.href = '/login.html';
  });

  AquaMap.init('map');

  let locations = [];
  let hazards = [];
  let routes = [];
  let pickMode = null; // 'start' | 'end' | 'report'
  const point = { start: null, end: null, report: null };

  const filters = () =>
    new Set(
      [...document.querySelectorAll('#filters input:checked')].map((i) => i.value)
    );

  // ---------- map feed ----------
  async function loadMap() {
    const data = await AquaAPI.request('/map');
    locations = data.locations;
    hazards = data.hazards;
    draw();
    updateStrip();
  }

  function draw() {
  const active = filters();
  const showLocations = active.has('WATERLOGGING') || active.has('OTHER');
  AquaMap.renderLocations(showLocations ? locations : []);
  AquaMap.renderHazards(hazards, active);
}

  function updateStrip() {
    const critical = locations.filter((l) => l.waterStatus === 'CRITICAL').length;
    const logged = locations.filter((l) => l.waterStatus === 'WATERLOGGED').length;
    const manholes = hazards.filter((h) => h.type === 'OPEN_MANHOLE').length;
    const clear = locations.filter((l) => l.waterStatus === 'NORMAL').length;
    document.getElementById('s-critical').textContent = critical;
    document.getElementById('s-logged').textContent = logged;
    document.getElementById('s-manholes').textContent = manholes;
    document.getElementById('s-clear').textContent = clear;
  }

  document.getElementById('filters').addEventListener('change', draw);

  // ---------- alerts ----------
  async function loadAlerts() {
    const { alerts } = await AquaAPI.request('/alerts');
    const feed = document.getElementById('alert-feed');
    if (!alerts.length) {
      feed.innerHTML = '<div class="empty">No alerts in the last few hours.</div>';
      return;
    }
    feed.innerHTML = alerts
      .slice(0, 12)
      .map(
        (a) => `<article class="${a.severity.toLowerCase()}">
          <h3>${a.title}</h3>
          <p>${a.message}</p>
          <time>${AquaAPI.timeAgo(a.createdAt)}</time>
        </article>`
      )
      .join('');
  }

  function prependAlert(alert) {
    const feed = document.getElementById('alert-feed');
    const empty = feed.querySelector('.empty');
    if (empty) feed.innerHTML = '';
    feed.insertAdjacentHTML(
      'afterbegin',
      `<article class="${alert.severity.toLowerCase()}">
        <h3>${alert.title}</h3><p>${alert.message}</p><time>just now</time>
      </article>`
    );
  }

  // ---------- realtime ----------
  const socket = io();
  const conn = document.getElementById('conn');
  socket.on('connect', () => socket.emit('join', 'citizens'));
  socket.on('disconnect', () => conn.querySelector('.live-dot').classList.add('down'));
  socket.io.on('reconnect', () => conn.querySelector('.live-dot').classList.remove('down'));
  socket.on('alert:new', prependAlert);
  socket.on('reading:new', ({ location }) => {
    const i = locations.findIndex((l) => l._id === location._id);
    if (i > -1) locations[i] = location;
    else locations.push(location);
    draw();
    updateStrip();
  });
  ['incident:new', 'incident:resolved', 'manhole:update', 'manhole:open'].forEach((ev) =>
    socket.on(ev, loadMap)
  );

  // ---------- map picking ----------
  AquaMap.onClick((lat, lng) => {
    const label = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    if (pickMode === 'report') {
      point.report = { lat, lng };
      document.getElementById('report-coords').value = label;
    } else if (pickMode === 'end' || (!point.start && pickMode !== 'end')) {
      // First click sets the start, the next sets the destination.
      if (!point.start) {
        point.start = { lat, lng };
        document.getElementById('route-start').value = label;
      } else {
        point.end = { lat, lng };
        document.getElementById('route-end').value = label;
      }
    } else {
      point.end = { lat, lng };
      document.getElementById('route-end').value = label;
    }
    AquaMap.setPin(lat, lng, 'Selected point');
  });

  // ---------- route planning (FR-16 to FR-19) ----------
  document.getElementById('use-location').addEventListener('click', async () => {
    try {
      const pos = await AquaAPI.locate();
      point.start = pos;
      document.getElementById('route-start').value = `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
      AquaMap.setPin(pos.lat, pos.lng, 'You are here');
    } catch (err) {
      alert(err.message);
    }
  });

  async function geocode(text) {
    const url =
      'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=' +
      encodeURIComponent(`${text}, Mumbai`);
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const hits = await res.json();
    if (!hits.length) throw new Error(`Could not find "${text}" in Mumbai.`);
    return { lat: Number(hits[0].lat), lng: Number(hits[0].lon) };
  }

  const coordsFrom = (value) => {
    const m = String(value).match(/^\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*$/);
    return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
  };

  document.getElementById('find-route').addEventListener('click', async () => {
    const results = document.getElementById('route-results');
    const startText = document.getElementById('route-start').value.trim();
    const endText = document.getElementById('route-end').value.trim();
    results.innerHTML = '<p class="c-muted">Checking hazards along each route…</p>';

    try {
      const start = coordsFrom(startText) || point.start || (await geocode(startText));
      const end = coordsFrom(endText) || (await geocode(endText));
      point.start = start;
      point.end = end;

      const data = await AquaAPI.request('/routes/plan', {
        method: 'POST',
        body: { start, destination: end }
      });
      routes = data.routes;
      AquaMap.drawRoutes(routes, 0);
      renderRoutes(data.recommended);
    } catch (err) {
      results.innerHTML = `<p class="c-critical">${err.message}</p>`;
    }
  });

  function renderRoutes(recommended) {
    const results = document.getElementById('route-results');
    results.innerHTML = routes
      .map(
        (r, i) => `
        <div class="route-option ${i === 0 ? 'active' : ''}" data-index="${i}">
          <h3>${AquaAPI.titleCase(r.type)}${r.type === recommended ? ' — recommended' : ''}</h3>
          <p>${r.distanceKm} km &middot; about ${r.durationMin} min &middot; risk ${r.riskScore}</p>
          ${r.warning ? `<p class="warn">${r.warning}</p>` : '<p>No reported hazards on this route.</p>'}
        </div>`
      )
      .join('');

    results.querySelectorAll('.route-option').forEach((el) =>
      el.addEventListener('click', () => {
        const index = Number(el.dataset.index);
        results.querySelectorAll('.route-option').forEach((o) => o.classList.remove('active'));
        el.classList.add('active');
        AquaMap.drawRoutes(routes, index);
      })
    );
  }

  // FR-20: if a new critical hazard lands, re-check the plotted route.
  socket.on('incident:new', async () => {
    if (!routes.length || !point.start || !point.end) return;
    const data = await AquaAPI.request('/routes/recheck', {
      method: 'POST',
      body: { start: point.start, destination: point.end, currentRiskScore: routes[0].riskScore }
    });
    if (data.shouldReroute) {
      routes = data.routes;
      AquaMap.drawRoutes(routes, 0);
      renderRoutes(data.recommended);
      prependAlert({
        severity: 'WARNING',
        title: 'Route updated',
        message: 'A new hazard appeared on your route, so we found a safer option.'
      });
    }
  });

  // ---------- hazard report (FR-12, FR-13) ----------
  const reportModal = document.getElementById('report-modal');
  const reportNotice = document.getElementById('report-notice');

  const openReport = () => {
    pickMode = 'report';
    reportNotice.className = 'notice';
    reportModal.classList.add('open');
  };
  const closeReport = () => {
    pickMode = null;
    reportModal.classList.remove('open');
  };

  document.getElementById('open-report').addEventListener('click', openReport);
  document.getElementById('report-cancel').addEventListener('click', closeReport);

  document.getElementById('report-locate').addEventListener('click', async () => {
    try {
      const pos = await AquaAPI.locate();
      point.report = pos;
      document.getElementById('report-coords').value = `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
    } catch (err) {
      reportNotice.className = 'notice show error';
      reportNotice.textContent = err.message;
    }
  });

  document.getElementById('report-submit').addEventListener('click', async () => {
    if (!point.report) {
      reportNotice.className = 'notice show error';
      reportNotice.textContent = 'Set the location first: use your location or tap the map.';
      return;
    }
    const form = new FormData();
    form.append('hazardType', document.getElementById('report-type').value);
    form.append('severity', document.getElementById('report-severity').value);
    form.append('description', document.getElementById('report-desc').value);
    form.append('lat', point.report.lat);
    form.append('lng', point.report.lng);
    const file = document.getElementById('report-image').files[0];
    if (file) form.append('image', file);

    try {
      const data = await AquaAPI.request('/reports', { method: 'POST', body: form, isForm: true });
      reportNotice.className = 'notice show ok';
      reportNotice.textContent = data.message;
      document.getElementById('report-desc').value = '';
      setTimeout(closeReport, 1600);
    } catch (err) {
      reportNotice.className = 'notice show error';
      reportNotice.textContent = err.message;
    }
  });

  // ---------- SOS (FR-21 to FR-23) ----------
  const sosModal = document.getElementById('sos-modal');
  const countdownEl = document.getElementById('sos-countdown');
  let countdownTimer = null;

  document.getElementById('sos-button').addEventListener('click', () => {
    sosModal.classList.add('open');
    let left = 5;
    countdownEl.textContent = left;
    countdownTimer = setInterval(() => {
      left -= 1;
      countdownEl.textContent = left;
      if (left <= 0) {
        clearInterval(countdownTimer);
        sendSos();
      }
    }, 1000);
  });

  const cancelSos = () => {
    clearInterval(countdownTimer);
    sosModal.classList.remove('open');
  };
  document.getElementById('sos-cancel').addEventListener('click', cancelSos);
  document.getElementById('sos-send').addEventListener('click', () => {
    clearInterval(countdownTimer);
    sendSos();
  });

  async function sendSos() {
    let position = point.start;
    try {
      position = await AquaAPI.locate();
    } catch {
      /* fall back to the last point the user set */
    }
    if (!position) {
      countdownEl.textContent = '!';
      alert('AquaGuard needs a location for the SOS. Allow location access or tap your position on the map.');
      return;
    }
    try {
      const data = await AquaAPI.request('/sos', {
        method: 'POST',
        body: {
          lat: position.lat,
          lng: position.lng,
          accuracy: position.accuracy,
          category: document.getElementById('sos-category').value,
          message: document.getElementById('sos-message').value
        }
      });
      sosModal.classList.remove('open');
      alert(data.message);
    } catch (err) {
      alert(err.message);
    }
  }

  // ---------- boot ----------
  loadMap().catch((e) => console.error(e));
  loadAlerts().catch((e) => console.error(e));
  setInterval(() => loadMap().catch(() => {}), 60000);
})();
