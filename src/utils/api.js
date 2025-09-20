// Auto-detect REST + PHP endpoints (dev/build) and cache them.
// Exposes: window.getCurrentState, window.saveCurrentState, window.backupStateToDB,
//          window.listBackups, window.restoreLatestFromDB

(function () {
  const isDev = location.port === '4174';

  // --- small helpers --------------------------------------------------------
  async function jsonFetch(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      credentials: 'same-origin',
      ...options,
    });
    let body = null;
    try { body = await res.json(); } catch {}
    if (!res.ok) {
      const err = new Error(`Request failed: ${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body ?? { ok: true };
  }

  async function tryUrl(method, url, body) {
    try {
      const data = await jsonFetch(url, body ? {
        method,
        body: JSON.stringify(body),
      } : { method });
      // We require `{ ok: true, ... }` shape for success
      if (data && (data.ok === true || data.success === true)) return { ok: true, data };
      return { ok: false, data };
    } catch (e) {
      return { ok: false, error: e };
    }
  }

  // --- endpoint detection (once + cache) -----------------------------------
  const LS_REST = 'bd_detected_rest_base';
  const LS_PHP  = 'bd_detected_php_base';

  function getCachedBase(key) {
    const v = localStorage.getItem(key);
    return v && typeof v === 'string' ? v : null;
  }
  function setCachedBase(key, val) {
    if (val) localStorage.setItem(key, val);
  }

  async function detectRestBase() {
    const cached = getCachedBase(LS_REST);
    if (cached) return cached;

    const candidates = isDev
      ? ['/rest-proxy/budget/v1', '/wp-json/budget/v1', '/?rest_route=/budget/v1']
      : [ (globalThis.BUDGET_API_BASE || '/?rest_route=/budget/v1'), '/wp-json/budget/v1' ];

    for (const base of candidates) {
      const r = await tryUrl('GET', `${base}/state`);
      if (r.ok) {
        setCachedBase(LS_REST, base);
        console.debug('[api.js] REST base detected:', base);
        return base;
      }
    }
    console.warn('[api.js] No REST base responded 200. Using last candidate anyway:', candidates.at(-1));
    return candidates.at(-1);
  }

  async function detectPhpBase() {
    const cached = getCachedBase(LS_PHP);
    if (cached) return cached;

    const candidates = isDev
      ? ['/php-api', '/api.php', '/budget-dashboard-fs/api.php']
      : ['/api.php', '/budget-dashboard-fs/api.php'];

    for (const base of candidates) {
      // `?action=ping` should return ok from our api.php
      const r = await tryUrl('GET', `${base}?action=ping`);
      if (r.ok) {
        setCachedBase(LS_PHP, base);
        console.debug('[api.js] PHP base detected:', base);
        return base;
      }
    }
    console.warn('[api.js] No PHP base responded. Using last candidate anyway:', candidates.at(-1));
    return candidates.at(-1);
  }

  // Lazily resolved bases
  let REST_BASE_PROM = null;
  let PHP_BASE_PROM  = null;
  function REST_BASE() { return REST_BASE_PROM ??= detectRestBase(); }
  function PHP_BASE()  { return PHP_BASE_PROM  ??= detectPhpBase();  }

  // --- Public helpers using detected bases ---------------------------------
  async function getCurrentState() {
    const rest = await REST_BASE();
    try {
      return await jsonFetch(`${rest}/state`, { method: 'GET' });
    } catch (e) {
      console.error('[getCurrentState]', e);
      return { ok: false, error: e.message || String(e), status: e.status, body: e.body };
    }
  }

  // Save with REST POST → REST PUT → PHP fallback
  async function saveCurrentState(state, version) {
    const rest = await REST_BASE();
    const php  = await PHP_BASE();
    const payload = { state, version };

    // REST POST
    try {
      const d = await jsonFetch(`${rest}/state`, { method: 'POST', body: JSON.stringify(payload) });
      if (d?.ok) return d;
      console.warn('[saveCurrentState] REST POST refused:', d);
    } catch (e) {
      console.warn('[saveCurrentState] REST POST failed, trying PUT...', e.status, e.body);
    }

    // REST PUT
    try {
      const d = await jsonFetch(`${rest}/state`, { method: 'PUT', body: JSON.stringify(payload) });
      if (d?.ok) return d;
      console.warn('[saveCurrentState] REST PUT refused:', d);
    } catch (e) {
      console.warn('[saveCurrentState] REST PUT failed:', e);
    }

    // PHP fallback
    try {
      return await jsonFetch(`${php}?action=state_save`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.error('[saveCurrentState] PHP failed:', e);
      return { ok: false, error: e.message || String(e), status: e.status, body: e.body };
    }
  }

  async function backupStateToDB(name = '') {
    const rest = await REST_BASE();
    try {
      return await jsonFetch(`${rest}/backup`, { method: 'POST', body: JSON.stringify({ name }) });
    } catch (e) {
      return { ok: false, error: e.message || String(e), status: e.status, body: e.body };
    }
  }

  async function listBackups() {
    const rest = await REST_BASE();
    try {
      return await jsonFetch(`${rest}/backup`, { method: 'GET' });
    } catch (e) {
      return { ok: false, error: e.message || String(e), status: e.status, body: e.body };
    }
  }

  async function restoreLatestFromDB() {
    const rest = await REST_BASE();
    try {
      return await jsonFetch(`${rest}/restore`, { method: 'POST', body: JSON.stringify({}) });
    } catch (e) {
      return { ok: false, error: e.message || String(e), status: e.status, body: e.body };
    }
  }

  // Expose
  window.getCurrentState      = getCurrentState;
  window.saveCurrentState     = saveCurrentState;
  window.backupStateToDB      = backupStateToDB;
  window.listBackups          = listBackups;
  window.restoreLatestFromDB  = restoreLatestFromDB;

  console.debug('[api.js] autodetect enabled (dev:', isDev, ')');
})();
