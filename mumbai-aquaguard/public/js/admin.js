/* Control room: counters, SOS queue, report verification, sensors and analytics. */
(() => {
  const user = AquaAPI.requireAuth(true);
  if (!user) return;

  document.getElementById('nav-signout').addEventListener('click', (e) => {
    e.preventDefault();
    AquaAPI.clearSession();
    location.href = '/login.html';
  });

  const $ = (id) => document.getElementById(id);

  const TILES = [
    ['totalSensors', 'Sensors', ''],
    ['onlineSensors', 'Online', 'c-normal'],
    ['offlineSensors', 'Offline', 'c-critical'],
    ['activeIncidents', 'Active incidents', 'c-logged'],
    ['criticalLocations', 'Critical locations', 'c-critical'],
    ['openManholes', 'Open manholes', 'c-warning'],
    ['waterloggedRoads', 'Waterlogged roads', 'c-logged'],
    ['pendingReports', 'Reports to verify', ''],
    ['activeSos', 'Active SOS', 'c-critical']
  ];

  async function loadSummary() {
    const { summary } = await AquaAPI.request('/dashboard/summary');
    $('tiles').innerHTML = TILES.map(
      ([key, label, cls]) =>
        `<div class="tile"><b class="${cls}">${summary[key]}</b><small>${label}</small></div>`
    ).join('');
  }

  // ---------- SOS (FR-25, FR-27) ----------
  const SOS_NEXT = {
    ACTIVE: 'ACKNOWLEDGED',
    ACKNOWLEDGED: 'ASSISTANCE_IN_PROGRESS',
    ASSISTANCE_IN_PROGRESS: 'RESOLVED'
  };

  async function loadSos() {
    const { sos } = await AquaAPI.request('/sos');
    const open = sos.filter((s) => s.status !== 'RESOLVED' && s.status !== 'CANCELLED');
    $('sos-rows').innerHTML = open.length
      ? open
          .map(
            (s) => `<tr>
              <td>${s.user?.name || 'Unknown'}<br /><small class="c-muted">${s.user?.mobile || ''}</small></td>
              <td>${AquaAPI.titleCase(s.category)}<br /><small class="c-muted">${s.message || ''}</small></td>
              <td>${AquaAPI.clock(s.createdAt)}<br /><small class="c-muted">${AquaAPI.timeAgo(s.createdAt)}</small></td>
              <td><span class="pill c-critical">${AquaAPI.titleCase(s.status)}</span></td>
              <td>
                <a class="btn ghost small" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lng}#map=17/${s.lat}/${s.lng}">Open map</a>
                ${SOS_NEXT[s.status] ? `<button class="btn small" data-sos="${s._id}" data-next="${SOS_NEXT[s.status]}">${AquaAPI.titleCase(SOS_NEXT[s.status])}</button>` : ''}
              </td>
            </tr>`
          )
          .join('')
      : '<tr><td colspan="5" class="c-muted">No open SOS alerts.</td></tr>';

    $('sos-rows')
      .querySelectorAll('[data-sos]')
      .forEach((btn) =>
        btn.addEventListener('click', async () => {
          await AquaAPI.request(`/sos/${btn.dataset.sos}/status`, {
            method: 'PUT',
            body: { status: btn.dataset.next }
          });
          loadSos();
          loadSummary();
        })
      );
  }

  // ---------- reports (FR-14) ----------
  async function loadReports() {
    const { reports } = await AquaAPI.request('/reports?status=PENDING');
    $('report-rows').innerHTML = reports.length
      ? reports
          .map(
            (r) => `<tr>
              <td>${AquaAPI.titleCase(r.hazardType)}<br /><small class="c-muted">${r.description || ''}</small>
                ${r.imageUrl ? `<br /><a href="${r.imageUrl}" target="_blank" rel="noopener">Photo</a>` : ''}</td>
              <td>${r.user?.name || 'Anonymous'}<br /><small class="c-muted">${AquaAPI.timeAgo(r.createdAt)}</small></td>
              <td>${AquaAPI.titleCase(r.severity)}</td>
              <td>
                <button class="btn small" data-review="${r._id}" data-action="VERIFY">Verify</button>
                <button class="btn ghost small" data-review="${r._id}" data-action="REJECT">Reject</button>
              </td>
            </tr>`
          )
          .join('')
      : '<tr><td colspan="4" class="c-muted">Nothing waiting for verification.</td></tr>';

    $('report-rows')
      .querySelectorAll('[data-review]')
      .forEach((btn) =>
        btn.addEventListener('click', async () => {
          await AquaAPI.request(`/reports/${btn.dataset.review}/review`, {
            method: 'PUT',
            body: { action: btn.dataset.action }
          });
          loadReports();
          loadIncidents();
          loadSummary();
        })
      );
  }

  // ---------- incidents ----------
  async function loadIncidents() {
    const { incidents } = await AquaAPI.request('/incidents?status=ACTIVE');
    $('incident-rows').innerHTML = incidents.length
      ? incidents
          .map(
            (i) => `<tr>
              <td>${AquaAPI.titleCase(i.type)}</td>
              <td>${i.location?.name || `${i.lat?.toFixed(4)}, ${i.lng?.toFixed(4)}`}</td>
              <td>${AquaAPI.titleCase(i.severity)}</td>
              <td>${AquaAPI.timeAgo(i.startTime)}</td>
              <td><button class="btn ghost small" data-resolve="${i._id}">Resolve</button></td>
            </tr>`
          )
          .join('')
      : '<tr><td colspan="5" class="c-muted">No active incidents.</td></tr>';

    $('incident-rows')
      .querySelectorAll('[data-resolve]')
      .forEach((btn) =>
        btn.addEventListener('click', async () => {
          await AquaAPI.request(`/incidents/${btn.dataset.resolve}/resolve`, { method: 'PUT' });
          loadIncidents();
          loadSummary();
        })
      );
  }

  // ---------- sensors (FR-37, FR-38) ----------
  async function loadSensors() {
    const { sensors } = await AquaAPI.request('/sensors');
    $('sensor-rows').innerHTML = sensors
      .map(
        (s) => `<tr>
          <td>${s.sensorId}<br /><small class="c-muted">${AquaAPI.titleCase(s.sensorType)}</small></td>
          <td>${s.location?.name || '—'}</td>
          <td><span class="pill ${s.healthy ? 'c-normal' : 'c-critical'}">${s.healthy ? 'Online' : 'Offline'}</span></td>
          <td>${s.batteryLevel ?? '—'}%</td>
          <td>${s.lastSeen ? AquaAPI.timeAgo(s.lastSeen) : 'never'}</td>
        </tr>`
      )
      .join('');
  }

  // ---------- manholes (FR-09, FR-11) ----------
  async function loadManholes() {
    const { manholes } = await AquaAPI.request('/manholes');
    $('manhole-rows').innerHTML = manholes
      .map(
        (m) => `<tr>
          <td>${m.manholeId}</td>
          <td>${m.location?.name || '—'}</td>
          <td><span class="pill ${m.status === 'OPEN' ? 'c-critical' : 'c-normal'}">${AquaAPI.titleCase(m.status)}</span></td>
          <td>${m.submerged ? 'Yes' : 'No'}</td>
          <td>
            <button class="btn ghost small" data-manhole="${m._id}" data-status="${m.status === 'OPEN' ? 'RESOLVED' : 'OPEN'}">
              ${m.status === 'OPEN' ? 'Mark repaired' : 'Mark open'}
            </button>
            <button class="btn ghost small" data-manhole="${m._id}" data-submerged="${!m.submerged}">
              ${m.submerged ? 'Water cleared' : 'Hidden by water'}
            </button>
          </td>
        </tr>`
      )
      .join('');

    $('manhole-rows')
      .querySelectorAll('[data-manhole]')
      .forEach((btn) =>
        btn.addEventListener('click', async () => {
          const body = btn.dataset.status
            ? { status: btn.dataset.status, coverStatus: btn.dataset.status === 'OPEN' ? 'OPEN' : 'CLOSED' }
            : { submerged: btn.dataset.submerged === 'true' };
          await AquaAPI.request(`/manholes/${btn.dataset.manhole}`, { method: 'PUT', body });
          loadManholes();
          loadSummary();
        })
      );
  }

  // ---------- analytics (FR-40) ----------
  const CHART_BASE = {
    responsive: true,
    plugins: { legend: { labels: { color: '#8db2bc' } } },
    scales: {
      x: { ticks: { color: '#8db2bc' }, grid: { color: '#1c5164' } },
      y: { ticks: { color: '#8db2bc' }, grid: { color: '#1c5164' } }
    }
  };

  async function loadAnalytics() {
    const { analytics } = await AquaAPI.request('/analytics/overview');

    new Chart($('chart-month'), {
      type: 'bar',
      data: {
        labels: analytics.waterloggingByMonth.map((m) => m._id),
        datasets: [
          {
            label: 'Waterlogging incidents by month',
            data: analytics.waterloggingByMonth.map((m) => m.count),
            backgroundColor: '#f2760c'
          }
        ]
      },
      options: CHART_BASE
    });

    new Chart($('chart-locations'), {
      type: 'bar',
      data: {
        labels: analytics.mostAffectedLocations.map((l) => l.name || 'Unknown'),
        datasets: [
          {
            label: 'Incidents by location',
            data: analytics.mostAffectedLocations.map((l) => l.count),
            backgroundColor: '#7fe3d4'
          }
        ]
      },
      options: { ...CHART_BASE, indexAxis: 'y' }
    });

    new Chart($('chart-rain'), {
      type: 'line',
      data: {
        labels: analytics.rainfallVsWaterlogging.map((r) => r._id),
        datasets: [
          {
            label: 'Rainfall (mm)',
            data: analytics.rainfallVsWaterlogging.map((r) => Math.round(r.rainfall)),
            borderColor: '#7fe3d4',
            tension: 0.3
          },
          {
            label: 'Water depth (cm)',
            data: analytics.rainfallVsWaterlogging.map((r) => Math.round(r.waterDepth)),
            borderColor: '#e63946',
            tension: 0.3
          }
        ]
      },
      options: CHART_BASE
    });
  }

  // ---------- realtime ----------
  const socket = io();
  socket.on('connect', () => socket.emit('join', 'admins'));
  socket.on('sos:new', () => {
    loadSos();
    loadSummary();
  });
  socket.on('report:new', () => {
    loadReports();
    loadSummary();
  });
  ['incident:new', 'incident:resolved', 'manhole:open', 'manhole:update'].forEach((ev) =>
    socket.on(ev, () => {
      loadIncidents();
      loadManholes();
      loadSummary();
    })
  );
  socket.on('sensor:offline', loadSensors);
  socket.on('reading:new', loadSensors);

  // ---------- boot ----------
  const boot = () =>
    Promise.all([
      loadSummary(),
      loadSos(),
      loadReports(),
      loadIncidents(),
      loadSensors(),
      loadManholes()
    ]).catch((e) => console.error(e));

  boot();
  loadAnalytics().catch((e) => console.error(e));
  setInterval(boot, 30000);
})();
