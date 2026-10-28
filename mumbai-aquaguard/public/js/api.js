/* Thin wrapper around fetch: attaches the token, unwraps errors, keeps the
   signed-in user in one place. */
const AquaAPI = (() => {
  const TOKEN_KEY = 'aquaguard.token';
  const USER_KEY = 'aquaguard.user';

  const getToken = () => localStorage.getItem(TOKEN_KEY);
  const getUser = () => {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch {
      return null;
    }
  };
  const setSession = (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  };
  const clearSession = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  async function request(path, { method = 'GET', body, isForm = false } = {}) {
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (!isForm && body) headers['Content-Type'] = 'application/json';

    const res = await fetch(`/api${path}`, {
      method,
      headers,
      body: isForm ? body : body ? JSON.stringify(body) : undefined
    });

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error('The server returned an unreadable response.');
    }
    if (!res.ok) {
      if (res.status === 401 && token) {
        clearSession();
        location.href = '/login.html';
      }
      throw new Error(data.message || 'Request failed.');
    }
    return data;
  }

  const requireAuth = (adminOnly = false) => {
    const user = getUser();
    if (!getToken() || !user) {
      location.href = '/login.html';
      return null;
    }
    if (adminOnly && user.role !== 'admin') {
      location.href = '/';
      return null;
    }
    return user;
  };

  const timeAgo = (date) => {
    const mins = Math.round((Date.now() - new Date(date).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    return `${Math.round(hrs / 24)} d ago`;
  };

  const clock = (date) =>
    new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const titleCase = (s) =>
    String(s || '').replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());

  /** Browser geolocation, wrapped so callers can await it (FR-03, FR-23). */
  const locate = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('This browser cannot share a location.'));
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
        () => reject(new Error('Location permission was declined. Pick the spot on the map instead.')),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

  return { request, getToken, getUser, setSession, clearSession, requireAuth, timeAgo, clock, titleCase, locate };
})();
