/* Budget Dashboard helper — unified REST + PHP api.php fallback
   Dev (4174):   /rest-proxy/budget/v1/*   and   /php-api?action=*
   PHP (10007):  /?rest_route=/budget/v1/* (no proxy), and /api.php?action=*
*/

(function () {
  const DEV = location.port === '4174';

  // REST base:
  // - dev: we hit the dev middleware "/rest-proxy"
  // - prod: we hit WP directly using rest_route (Local’s /wp-json may be 404)
  const restBase = DEV
    ? '/rest-proxy/budget/v1'
    : '/?rest_route=/budget/v1';

  // PHP api.php base (works both dev via /php-api and prod via /api.php)
  const phpBase = DEV ? '/php-api' : '/api.php';

  async function jsonFetch(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      credentials: 'same-origin',
      ...options,
    });
    let body = null;
    try { body = await res.json(); } catch { /* ignore */ }
    if (!res.ok) {
      const err = new Error(`Request failed: ${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body ?? { ok: true };
  }

  // ---------- State ----------
  async function getCurrentState() {
    // Try REST first
    try {
      return await jsonFetch(`${restBase}/state`, { method: 'GET' });
    } catch (e) {
      console.warn('[getCurrentState] REST failed, fallback to PHP:', e.status);
      // Fallback to api.php
      try {
        const qs = `${phpBase}?action=state_get`;
        return await jsonFetch(qs, { method: 'GET' });
      } catch (e2) {
        console.error('[getCurrentState] PHP failed:', e2);
        return { ok: false, error: e2.message || String(e2), status: e2.status, body: e2.body };
      }
    }
  }

  async function saveCurrentState(state, version) {
    const payload = { state, version };

    // Try REST (POST first, then PUT fallback)
    try {
      const out = await jsonFetch(`${restBase}/state`, { method: 'POST', body: JSON.stringify(payload) });
      if (out?.ok) return out;
    } catch (e) {
      console.warn('[saveCurrentState] REST POST failed, trying PUT...', e.status);
      try {
        const out = await jsonFetch(`${restBase}/state`, { method: 'PUT', body: JSON.stringify(payload) });
        if (out?.ok) return out;
      } catch (e2) {
        console.warn('[saveCurrentState] REST PUT failed:', e2.status);
      }
    }

    // Fallback to api.php
    try {
      const out = await jsonFetch(`${phpBase}?action=state_save`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return out;
    } catch (e3) {
      console.error('[saveCurrentState] PHP failed:', e3);
      return { ok: false, error: e3.message || String(e3), status: e3.status, body: e3.body };
    }
  }

  // ---------- Backups ----------
  async function backupStateToDB(name = '') {
    // REST first
    try {
      return await jsonFetch(`${restBase}/backup`, { method: 'POST', body: JSON.stringify({ name }) });
    } catch {
      // fallback to PHP
      try {
        return await jsonFetch(`${phpBase}?action=backup_create`, {
          method: 'POST',
          body: JSON.stringify({ name }),
        });
      } catch (e) {
        return { ok: false, error: e.message || String(e), status: e.status, body: e.body };
      }
    }
  }

  async function listBackups() {
    try {
      return await jsonFetch(`${restBase}/backup`, { method: 'GET' });
    } catch {
      try {
        return await jsonFetch(`${phpBase}?action=list_backups`, { method: 'GET' });
      } catch (e) {
        return { ok: false, error: e.message || String(e), status: e.status, body: e.body };
      }
    }
  }

  async function restoreLatestFromDB() {
    try {
      return await jsonFetch(`${restBase}/restore`, { method: 'POST', body: JSON.stringify({}) });
    } catch {
      try {
        return await jsonFetch(`${phpBase}?action=restore_latest`, { method: 'POST', body: JSON.stringify({}) });
      } catch (e) {
        return { ok: false, error: e.message || String(e), status: e.status, body: e.body };
      }
    }
  }

  // expose
  window.getCurrentState = getCurrentState;
  window.saveCurrentState = saveCurrentState;
  window.backupStateToDB = backupStateToDB;
  window.listBackups = listBackups;
  window.restoreLatestFromDB = restoreLatestFromDB;

  console.debug('[api.js] restBase =', restBase, '| phpBase =', phpBase);
})();
