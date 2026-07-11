const app = document.querySelector('#app');
const toast = document.querySelector('#toast');

const state = {
  token: localStorage.getItem('cv_token'),
  user: JSON.parse(localStorage.getItem('cv_user') || 'null'),
  route: location.hash.replace('#', '') || 'dashboard',
  profile: null,
  applications: [],
};

/* ----------------------------------------------------------------
   Inline icon set — understated, single-stroke, functional.
   ---------------------------------------------------------------- */
const icons = {
  overview: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h6"/></svg>',
  briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M2 13h20"/></svg>',
  logo: '<img src="/favicons/logo.png" alt="Logo" style="width: 28px; height: 28px; object-fit: contain; vertical-align: middle; filter: drop-shadow(0 0 2px rgba(0,0,0,0.5));" />',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4"/><path d="M12 17v4"/><path d="M3 12h4"/><path d="M17 12h4"/><path d="m6 6 2.5 2.5"/><path d="m15.5 15.5 2.5 2.5"/><path d="m18 6-2.5 2.5"/><path d="m8.5 15.5-2.5 2.5"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  graduation: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 9 12 5 2 9l10 4 10-4Z"/><path d="M6 11v5a6 3 0 0 0 12 0v-5"/></svg>',
  layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 12 12 17 22 12"/><polyline points="2 17 12 22 22 17"/></svg>',
  award: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="m8.5 13-1.5 8 5-3 5 3-1.5-8"/></svg>',
  empty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>',
  xray: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.2 15c.7-1.2 1-2.5.7-3.9-.6-2-2.4-3.5-4.4-3.5h-1.2c-.7-3-3.2-5.2-6.2-5.6-3-.3-5.9 1.3-7.3 4-1.2 2.5-1 6.5.5 8.8m8.7-1.6V21"/><path d="M16 16v5"/><path d="M8 16v5"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
};

/* ----------------------------------------------------------------
   API client
   ---------------------------------------------------------------- */
const api = {
  async request(path, options = {}) {
    const headers = options.headers || {};
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    if (state.token) {
      headers.Authorization = `Bearer ${state.token}`;
    }

    // Abort genuinely hung requests. 60s sits well above normal AI latency
    // (a few seconds) so it only trips on a stuck connection.
    const controller = new AbortController();
    if (options.signal?.aborted) controller.abort();
    else if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || 60000);

    let response;
    try {
      response = await fetch(path, { ...options, headers, signal: controller.signal });
    } catch (err) {
      if (err.name === 'AbortError') {
        if (options.signal?.aborted) {
          throw new Error('Request cancelled by user.');
        }
        throw new Error('The request timed out. Please check your connection and try again.');
      }
      throw new Error('Network error. Please check your connection and try again.');
    } finally {
      clearTimeout(timeoutId);
    }

    const contentType = response.headers.get('content-type') || '';

    if (!response.ok) {
      if (contentType.includes('application/json')) {
        const data = await response.json();
        let message = data.error || 'Request failed.';
        // Surface the specific reasons a document was rejected (e.g. X-Ray non-CV).
        if (Array.isArray(data.missing) && data.missing.length > 0) {
          message += ` Missing: ${data.missing.join(', ')}.`;
        }
        throw new Error(message);
      }
      throw new Error('Request failed.');
    }

    if (contentType.includes('application/json')) {
      return response.json();
    }
    return response.blob();
  },
  get(path, options = {}) {
    return this.request(path, options);
  },
  post(path, body, options = {}) {
    return this.request(path, { method: 'POST', body: JSON.stringify(body), ...options });
  },
  put(path, body, options = {}) {
    return this.request(path, { method: 'PUT', body: JSON.stringify(body), ...options });
  },
  patch(path, body, options = {}) {
    return this.request(path, { method: 'PATCH', body: JSON.stringify(body), ...options });
  },
  delete(path, options = {}) {
    return this.request(path, { method: 'DELETE', ...options });
  },
  upload(path, formData, options = {}) {
    return this.request(path, { method: 'POST', body: formData, ...options });
  },
};

/* ----------------------------------------------------------------
   Shared UI helpers
   ---------------------------------------------------------------- */
function showToast(message, type = 'info') {
  toast.textContent = message;
  toast.className = `toast show${type === 'error' ? ' error' : ''}`;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 4200);
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function initials(value = '') {
  const parts = String(value).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '–';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function greetWord() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function setAuth(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem('cv_token', token);
  localStorage.setItem('cv_user', JSON.stringify(user));
}

function clearAuth() {
  state.token = null;
  state.user = null;
  state.profile = null;
  state.applications = [];
  localStorage.removeItem('cv_token');
  localStorage.removeItem('cv_user');
}

function navigate(route) {
  location.hash = route;
}
// Exposed on window so the separately-loaded dataGrid.js can navigate safely.
window.navigate = navigate;

function scoreClass(score) {
  if (score >= 75) return 'high';
  if (score >= 45) return 'mid';
  return '';
}

function redFlagScoreClass(score) {
  if (score >= 50) return 'flag-high';
  if (score >= 20) return 'flag-mid';
  return 'flag-low';
}

/* Replace a button's content with an inline spinner while a request runs. */
function setBtnLoading(button, label) {
  if (!button) return () => {};
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `<span class="spin"></span> ${escapeHtml(label)}`;
  return () => {
    button.disabled = false;
    button.innerHTML = original;
  };
}

/* Full-screen contextual loader for slow AI calls: rotating status,
   step dots, and an elapsed-seconds counter so long waits feel alive. */
function aiLoader(title, steps, onCancel) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="loader-card" role="status" aria-live="polite">
      <div class="loader-ring" aria-hidden="true"></div>
      <div class="l-title">${escapeHtml(title)}</div>
      <div class="l-status"></div>
      <div class="loader-steps" aria-hidden="true">${steps.map(() => '<span></span>').join('')}</div>
      <div class="l-timer">0s elapsed</div>
      <button class="btn ghost btn-cancel-loader" style="margin-top: 20px; width: 100%;">Cancel</button>
    </div>`;
  document.body.appendChild(overlay);

  const statusEl = overlay.querySelector('.l-status');
  const timerEl = overlay.querySelector('.l-timer');
  const dots = [...overlay.querySelectorAll('.loader-steps span')];
  let step = 0;

  const paint = () => {
    statusEl.textContent = steps[step];
    dots.forEach((dot, index) => dot.classList.toggle('on', index <= step));
  };
  paint();

  const stepTimer = window.setInterval(() => {
    if (step < steps.length - 1) {
      step += 1;
      paint();
    }
  }, 2600);

  const startedAt = Date.now();
  const tick = window.setInterval(() => {
    timerEl.textContent = `${Math.round((Date.now() - startedAt) / 1000)}s elapsed`;
  }, 1000);

  if (onCancel) {
    overlay.querySelector('.btn-cancel-loader').addEventListener('click', onCancel);
  } else {
    overlay.querySelector('.btn-cancel-loader').remove();
  }

  return {
    stop() {
      window.clearInterval(stepTimer);
      window.clearInterval(tick);
      overlay.remove();
    },
  };
}

async function runWithLoader(title, steps, fn) {
  const controller = new AbortController();
  const loader = aiLoader(title, steps, () => {
    controller.abort();
  });
  try {
    return await fn(controller.signal);
  } finally {
    loader.stop();
  }
}

function emptyState({ icon = 'empty', title, message, actionLabel, actionRoute }) {
  return `
    <div class="state">
      <div class="state-ico">${icons[icon] || icons.empty}</div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
      ${actionLabel ? `<button class="btn primary" data-route="${actionRoute}">${escapeHtml(actionLabel)}</button>` : ''}
    </div>`;
}

// Renders a text block that is visually clamped to `lines` rows with a
// "See more/See less" toggle. `innerHtml` must already be escaped.
function clampBlock(innerHtml, lines = 10, extraClass = '') {
  return `
    <div class="clampable">
      <div class="clamp-body clamped ${extraClass}" style="--clamp-lines:${lines}">${innerHtml}</div>
      <button class="clamp-toggle" type="button" data-more="See more" data-less="See less">See more</button>
    </div>`;
}

// Activates clamp toggles after render. Hides the toggle when the content does
// not actually overflow the clamp, so short text has no dangling "See more".
/* Attach eye-toggle behaviour to every .pw-toggle in the current view. */
function wirePwToggles(root = document) {
  root.querySelectorAll('.pw-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const wrap = btn.closest('.pw-wrap');
      const input = wrap && wrap.querySelector('input');
      if (!input) return;
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.innerHTML = showing ? icons.eye : icons.eyeOff;
      btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    });
  });
}

function wireClamps(root = document) {
  root.querySelectorAll('.clampable').forEach((wrap) => {
    const body = wrap.querySelector('.clamp-body');
    const toggle = wrap.querySelector('.clamp-toggle');
    if (!body || !toggle) return;

    if (body.scrollHeight <= body.clientHeight + 2) {
      body.classList.remove('clamped');
      toggle.style.display = 'none';
      return;
    }

    toggle.addEventListener('click', () => {
      const clamped = body.classList.toggle('clamped');
      toggle.textContent = clamped ? toggle.dataset.more : toggle.dataset.less;
    });
  });
}

function showModal({ title, content, actions = [] }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
  const buttonsHtml = actions.map((action, i) => 
    `<button class="btn ${action.primary ? 'primary' : 'ghost'}" id="modal-btn-${i}">${escapeHtml(action.label)}</button>`
  ).join('');

  overlay.innerHTML = `
    <div class="modal-dialog" role="dialog" aria-modal="true">
      <div class="modal-head">
        <h2>${escapeHtml(title)}</h2>
      </div>
      <div class="modal-body">${escapeHtml(content)}</div>
      <div class="modal-actions">
        ${buttonsHtml}
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);

  const close = () => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 200);
  };

  actions.forEach((action, i) => {
    const btn = overlay.querySelector(`#modal-btn-${i}`);
    btn.addEventListener('click', () => {
      close();
      if (action.onClick) action.onClick();
    });
  });

  return close;
}

/* ----------------------------------------------------------------
   Profile form serialization helpers
   ---------------------------------------------------------------- */
function linesToArray(value) {
  return String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function arrayToLines(value) {
  return Array.isArray(value) ? value.join('\n') : '';
}

function objectsToLines(items, fields) {
  if (!Array.isArray(items)) return '';
  return items.map((item) => fields.map((field) => item[field] || '').join(' | ')).join('\n');
}

function linesToObjects(value, fields) {
  return linesToArray(value).map((line) => {
    const parts = line.split('|').map((part) => part.trim());
    return fields.reduce((result, field, index) => {
      result[field] = parts[index] || '';
      return result;
    }, {});
  });
}

/* ----------------------------------------------------------------
   Auth screen
   ---------------------------------------------------------------- */
function authView(mode = 'login') {
  const isRegister = mode === 'register';
  app.innerHTML = `
    <main class="auth-shell">
      <aside class="auth-aside">
        <div class="brand-row" style="position: relative; z-index: 2;">
          <span class="logo">${icons.logo}</span>
          <span class="brand-name">CV Builder</span>
        </div>
        
        <div class="cv-mock-visual">
          <div class="cv-mock-doc">
            <div class="cv-md-header">
              <div class="cv-md-avatar"></div>
              <div class="cv-md-h-lines">
                <div class="cv-md-line h1"></div>
                <div class="cv-md-line sub"></div>
              </div>
            </div>
            <div class="cv-md-body">
              <div class="cv-md-section">
                <div class="cv-md-sec-title"></div>
                <div class="cv-md-line block"></div>
                <div class="cv-md-line block"></div>
                <div class="cv-md-line block short"></div>
              </div>
              <div class="cv-md-section">
                <div class="cv-md-sec-title"></div>
                <div class="cv-md-item">
                  <div class="cv-md-dot"></div>
                  <div class="cv-md-line thin"></div>
                </div>
                <div class="cv-md-item">
                  <div class="cv-md-dot"></div>
                  <div class="cv-md-line thin"></div>
                </div>
                <div class="cv-md-item">
                  <div class="cv-md-dot"></div>
                  <div class="cv-md-line thin shorter"></div>
                </div>
              </div>
            </div>
            <div class="cv-md-stamp">ATS Optimized</div>
          </div>
        </div>

        <div class="auth-hero" style="position: relative; z-index: 2;">
          <h1>Precision tools for<br>modern careers.</h1>
          <p>Build a structured CV profile, measure it against any job description with an ATS score, and generate focused cover letters all through a secure Express API.</p>
        </div>
      </aside>
      <section class="auth-main">
        <div class="auth-card">
          <div class="auth-card-top-bar"></div>
          <div class="auth-card-inner">
            <div class="auth-card-icon">
              ${isRegister
                ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>`
                : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`
              }
            </div>
            <h2>${isRegister ? 'Create your account' : 'Welcome back'}</h2>
            <p>${isRegister ? 'Start building your career toolkit today.' : 'Sign in to continue your journey.'}</p>
            <form class="form" id="authForm" novalidate>
              ${isRegister ? `
              <div class="field auth-field">
                <label for="fullName">Full name</label>
                <div class="auth-input-wrap">
                  <svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
                  <input id="fullName" name="fullName" autocomplete="name" placeholder="Jane Carter" required>
                </div>
              </div>` : ''}
              <div class="field auth-field">
                <label for="email">Email</label>
                <div class="auth-input-wrap">
                  <svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  <input id="email" name="email" type="email" autocomplete="email" placeholder="you@email.com" required>
                </div>
              </div>
              <div class="field auth-field">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <label for="password">Password</label>
                  ${!isRegister ? `<a href="#forgot-password" style="font-size: 12.5px; color: var(--accent); text-decoration: none; font-weight: 550; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">Forgot password?</a>` : ''}
                </div>
                <div class="auth-input-wrap pw-wrap">
                  <svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <input id="password" name="password" type="password" autocomplete="${isRegister ? 'new-password' : 'current-password'}" placeholder="At least 8 characters" minlength="8" required>
                  <button class="pw-toggle" type="button" aria-label="Show password">${icons.eye}</button>
                </div>
              </div>
              ${isRegister ? `
              <div style="display: flex; align-items: center; gap: 10px; margin: 4px 0 12px 0; user-select: none;">
                <div class="custom-checkbox-wrap">
                  <input type="checkbox" id="termsAgree" name="termsAgree" required style="display: none;">
                  <label for="termsAgree" class="custom-checkbox-box"></label>
                </div>
                <label for="termsAgree" style="margin: 0; font-size: 13px; color: var(--muted); cursor: pointer; line-height: 1.4;">
                  I agree to the <a href="#terms" class="legal-link">Terms & Conditions</a> and <a href="#privacy" class="legal-link">Privacy Policy</a>
                </label>
              </div>
              ` : ''}
              <button class="btn primary block lg auth-submit-btn" type="submit">
                ${isRegister ? 'Create account' : 'Sign in'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;margin-left:6px;"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </button>
            </form>
            <p class="auth-switch">
              ${isRegister ? 'Already registered?' : 'Need an account?'}
              <button class="link-button" id="switchAuth" type="button">${isRegister ? 'Sign in' : 'Create one'}</button>
            </p>
          </div>
        </div>
      </section>
    </main>`;

  document.querySelector('#switchAuth').addEventListener('click', () => navigate(isRegister ? 'login' : 'register'));

  wirePwToggles();

  document.querySelector('#authForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    
    if (isRegister) {
      const checkbox = form.querySelector('#termsAgree');
      if (!checkbox || !checkbox.checked) {
        showToast('You must agree to the Terms & Conditions and Privacy Policy to register.', 'error');
        return;
      }
    }

    const body = Object.fromEntries(new FormData(form).entries());
    const restore = setBtnLoading(form.querySelector('button[type="submit"]'), isRegister ? 'Creating…' : 'Signing in…');
    try {
      const data = await api.post(`/api/auth/${isRegister ? 'register' : 'login'}`, body);
      setAuth(data.token, data.user);
      if (isRegister) {
        sessionStorage.setItem('just_registered', '1');
      }
      if (data.requirePasswordChange) {
        navigate('update-password');
      } else {
        navigate('dashboard');
      }
      await render();
    } catch (err) {
      showToast(err.message, 'error');
      restore();
    }
  });
}

async function forgotPasswordView() {
  app.innerHTML = `
    <main class="auth-shell">
      <aside class="auth-aside">
        <div class="brand-row" style="position: relative; z-index: 2;">
          <span class="logo">${icons.logo}</span>
          <span class="brand-name">CV Builder</span>
        </div>
        
        <div class="cv-mock-visual">
          <div class="cv-mock-doc">
            <div class="cv-md-header">
              <div class="cv-md-avatar"></div>
              <div class="cv-md-h-lines">
                <div class="cv-md-line h1"></div>
                <div class="cv-md-line sub"></div>
              </div>
            </div>
            <div class="cv-md-body">
              <div class="cv-md-section">
                <div class="cv-md-sec-title"></div>
                <div class="cv-md-line block"></div>
                <div class="cv-md-line block"></div>
                <div class="cv-md-line block short"></div>
              </div>
              <div class="cv-md-section">
                <div class="cv-md-sec-title"></div>
                <div class="cv-md-item">
                  <div class="cv-md-dot"></div>
                  <div class="cv-md-line thin"></div>
                </div>
                <div class="cv-md-item">
                  <div class="cv-md-dot"></div>
                  <div class="cv-md-line thin"></div>
                </div>
                <div class="cv-md-item">
                  <div class="cv-md-dot"></div>
                  <div class="cv-md-line thin shorter"></div>
                </div>
              </div>
            </div>
            <div class="cv-md-stamp">ATS Optimized</div>
          </div>
        </div>

        <div class="auth-hero" style="position: relative; z-index: 2;">
          <h1>Recover your account.</h1>
          <p>Enter your registered email address and we'll help you secure and reset your password.</p>
        </div>
      </aside>
      <section class="auth-main">
        <div class="auth-card">
          <div class="auth-card-top-bar"></div>
          <div class="auth-card-inner">
            <div class="auth-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
            </div>
            <h2>Forgot password?</h2>
            <p>No worries, we'll send a temporary password to your email.</p>
            <form class="form" id="forgotForm" novalidate>
              <div class="field auth-field">
                <label for="email">Email Address</label>
                <div class="auth-input-wrap">
                  <svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  <input id="email" name="email" type="email" autocomplete="email" placeholder="you@email.com" required>
                </div>
              </div>
              <button class="btn primary" type="submit" style="width: 100%; margin-top: 10px;">Send Temporary Password</button>
            </form>
            
            <div id="devLinkContainer" style="display: none; margin-top: 20px; padding: 15px; border-radius: 8px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); font-size: 13px; text-align: left;">
              <div style="font-weight: 600; color: var(--accent); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #3b82f6; animation: pulse 2s infinite;"></span>
                Local Demo Mode Password:
              </div>
              <div style="color: var(--muted); margin-bottom: 8px; font-size: 12px; line-height: 1.4;">
                SMTP is not configured in .env. Here is the generated temporary password:
              </div>
              <div style="display: flex; gap: 8px; align-items: center;">
                <input id="devLinkInput" readonly style="flex: 1; font-size: 12px; padding: 6px 10px; background: var(--surface-3); border: 1px solid var(--line-strong); border-radius: 6px; color: var(--text);" />
                <button id="devLinkCopy" class="btn" style="padding: 6px 10px; font-size: 12px; height: auto; display: flex; align-items: center; justify-content: center; gap: 4px; border-radius: 6px;">
                  Copy
                </button>
              </div>
            </div>

            <p class="auth-switch" style="margin-top: 24px;">
              <a href="#login" style="color: var(--muted); text-decoration: none; font-size: 13.5px; font-weight: 500; transition: color 0.15s;" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--muted)'">Back to Sign In</a>
            </p>
          </div>
        </div>
      </section>
    </main>
  `;

  document.querySelector('#forgotForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const restore = setBtnLoading(form.querySelector('button[type="submit"]'), 'Sending…');
    const devLinkContainer = document.querySelector('#devLinkContainer');
    devLinkContainer.style.display = 'none';

    const emailInput = form.querySelector('#email').value;
    try {
      const res = await api.post('/api/auth/forgot-password', { email: emailInput });
      showToast(res.message, 'info');
      navigate('login');
      await render();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      restore();
    }
  });
}

async function updatePasswordView() {
  let timerInterval;

  try {
    if (state.token) {
      const meRes = await api.get('/api/auth/me');
      setAuth(state.token, meRes.user);
      
      // If the backend says they don't actually need to change their password, bounce them out!
      if (!meRes.user.mustChangePassword) {
        navigate('dashboard');
        return render();
      }
    }
  } catch (err) {
    // silently fail, fallback to existing state.user
  }

  app.innerHTML = `
    <main class="auth-shell">
      <section class="auth-main" style="width: 100%; justify-content: center; grid-column: 1 / -1;">
        <div class="auth-card" style="max-width: 450px;">
          <div class="auth-card-top-bar"></div>
          <div class="auth-card-inner">
            <div class="auth-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
            <h2>Update Password</h2>
            <p>You are logging in with a temporary password. You must create a new secure password to proceed.</p>
            <div id="pwTimerContainer" style="display: none; margin-bottom: 15px; padding: 10px; border-radius: 6px; text-align: center; background: var(--surface-2); border: 1px solid var(--line);">
              <span id="pwTimerText" style="font-weight: 600; color: var(--accent);">--:--</span>
            </div>
            <form class="form" id="forcePwForm" novalidate>
              <div class="field auth-field">
                <label for="currentPassword">Temporary Password</label>
                <div class="pw-wrap">
                  <input id="currentPassword" name="currentPassword" type="password" autocomplete="off" required>
                  <button type="button" class="pw-toggle" aria-label="Show password">${icons.eyeOff}</button>
                </div>
              </div>
              <div class="field auth-field">
                <label for="newPassword">New Password</label>
                <div class="pw-wrap">
                  <input id="newPassword" name="newPassword" type="password" autocomplete="new-password" placeholder="At least 8 characters, 1 uppercase, 1 number" required>
                  <button type="button" class="pw-toggle" aria-label="Show password">${icons.eyeOff}</button>
                </div>
              </div>
              <div class="field auth-field">
                <label for="confirmPassword">Confirm New Password</label>
                <div class="pw-wrap">
                  <input id="confirmPassword" name="confirmPassword" type="password" autocomplete="new-password" placeholder="Re-enter your new password" required>
                  <button type="button" class="pw-toggle" aria-label="Show password">${icons.eyeOff}</button>
                </div>
              </div>
              <button class="btn primary" type="submit" id="submitPwBtn" style="width: 100%; margin-top: 10px;">Save New Password</button>
            </form>
            <div style="margin-top: 15px; text-align: center;">
              <button id="resendTempPwBtn" class="btn ghost" disabled style="width: 100%;">Resend Temporary Password</button>
            </div>
            <div id="resendDevLinkContainer" style="display: none; margin-top: 20px; padding: 15px; border-radius: 8px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); font-size: 13px; text-align: left;">
              <div style="font-weight: 600; color: var(--accent); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #3b82f6; animation: pulse 2s infinite;"></span>
                New Local Demo Mode Password:
              </div>
              <div style="color: var(--muted); margin-bottom: 8px; font-size: 12px; line-height: 1.4;">
                SMTP is not configured. Here is the new temporary password:
              </div>
              <div style="display: flex; gap: 8px; align-items: center;">
                <input id="resendDevLinkInput" readonly style="flex: 1; font-size: 12px; padding: 6px 10px; background: var(--surface-3); border: 1px solid var(--line-strong); border-radius: 6px; color: var(--text);" />
                <button id="resendDevLinkCopy" class="btn" style="padding: 6px 10px; font-size: 12px; height: auto; display: flex; align-items: center; justify-content: center; gap: 4px; border-radius: 6px;">
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  `;

  wirePwToggles();

  const timerText = document.getElementById('pwTimerText');
  const timerContainer = document.getElementById('pwTimerContainer');
  const resendBtn = document.getElementById('resendTempPwBtn');
  const formFields = document.querySelectorAll('#forcePwForm input');
  const submitBtn = document.getElementById('submitPwBtn');

  function updateTimer() {
    if (!state.user.resetTokenExpires) return;
    timerContainer.style.display = 'block';

    const expiresAt = new Date(state.user.resetTokenExpires).getTime();
    const now = Date.now();
    const remaining = Math.max(0, expiresAt - now);

    if (remaining <= 0) {
      if (timerInterval) clearInterval(timerInterval);
      timerText.textContent = 'Expired';
      timerText.style.color = 'var(--error)';
      resendBtn.disabled = false;
      formFields.forEach(f => f.disabled = true);
      submitBtn.disabled = true;
    } else {
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      timerText.textContent = `Expires in: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      timerText.style.color = 'var(--accent)';
      resendBtn.disabled = true;
      formFields.forEach(f => f.disabled = false);
      submitBtn.disabled = false;
    }
  }

  if (state.user.resetTokenExpires) {
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
  }

  resendBtn.addEventListener('click', async () => {
    const restore = setBtnLoading(resendBtn, 'Resending…');
    const devLinkContainer = document.getElementById('resendDevLinkContainer');
    if (devLinkContainer) devLinkContainer.style.display = 'none';

    try {
      const res = await api.post('/api/auth/forgot-password', { email: state.user.email });
      const meRes = await api.get('/api/auth/me');
      setAuth(state.token, meRes.user);
      showToast('New temporary password sent.');

      if (timerInterval) clearInterval(timerInterval);
      
      // Update timer in place without losing the devTempPassword UI by re-rendering the whole view
      updateTimer();
      timerInterval = setInterval(updateTimer, 1000);
      
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      restore();
    }
  });

  document.querySelector('#forcePwForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    
    const newPassword = form.querySelector('#newPassword').value;
    const confirmPassword = form.querySelector('#confirmPassword').value;
    
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }

    const restore = setBtnLoading(form.querySelector('button[type="submit"]'), 'Saving…');
    try {
      await api.post('/api/auth/update-password', Object.fromEntries(new FormData(form)));
      if (timerInterval) clearInterval(timerInterval);
      state.user.mustChangePassword = false;
      localStorage.setItem('cv_user', JSON.stringify(state.user));
      showToast('Password changed successfully.');
      navigate('dashboard');
      await render();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      restore();
    }
  });
}

/* ----------------------------------------------------------------
   Authenticated shell — left rail + topbar
   ---------------------------------------------------------------- */
const RAIL = [
  { route: 'dashboard', label: 'Home', icon: 'overview' },
  { route: 'profile', label: 'Profile', icon: 'profile' },
  { route: 'cv', label: 'CV', icon: 'doc' },
  { route: 'applications', label: 'Apps', icon: 'briefcase' },
  { route: 'xray', label: 'X-Ray', icon: 'xray' },
  { route: 'settings', label: 'Settings', icon: 'settings' },
];

function activeRailKey() {
  if (state.route.startsWith('application') || state.route === 'new-application') return 'applications';
  return state.route;
}

function shell(content, { search = false } = {}) {
  const activeKey = activeRailKey();
  const name = state.user.fullName || state.user.email;
  app.innerHTML = `
    <div class="app-shell">
      <aside class="rail">
        <span class="logo" title="CV Builder">${icons.logo}</span>
        <nav aria-label="Primary">
          ${RAIL.map((item) => `
            <button class="rail-btn ${activeKey === item.route ? 'active' : ''}" data-route="${item.route}" title="${item.label}" ${activeKey === item.route ? 'aria-current="page"' : ''}>
              <span class="ico">${icons[item.icon]}</span>
              <span class="lbl">${item.label}</span>
            </button>`).join('')}
        </nav>
        <span class="rail-spacer"></span>
        <button class="rail-btn signout" id="logoutBtn" title="Sign out">
          <span class="ico">${icons.logout}</span>
          <span class="lbl">Out</span>
        </button>
      </aside>
      <main class="main">
        <div class="topbar">
          ${search
            ? `<label class="search"><span aria-hidden="true">${icons.search}</span><input id="globalSearch" type="search" placeholder="Search your applications…" aria-label="Search applications"></label>`
            : '<span class="rail-spacer"></span>'}
          <div class="topbar-right" id="topbarProfile" style="cursor: pointer;" title="Go to Profile">
            <div class="greeting">
              <div class="hi">${greetWord()},</div>
              <div class="nm">${escapeHtml(name)}</div>
            </div>
            <div class="avatar">${escapeHtml(initials(name))}</div>
          </div>
        </div>
        ${content}
      </main>
    </div>
    <button class="fab" id="fab" title="New application" aria-label="New application">${icons.plus}</button>`;

  document.querySelectorAll('[data-route]').forEach((button) => {
    button.addEventListener('click', () => navigate(button.dataset.route));
  });
  document.querySelector('#topbarProfile').addEventListener('click', () => navigate('profile'));
  document.querySelector('#logoutBtn').addEventListener('click', () => {
    clearAuth();
    authView();
  });
  document.querySelector('#fab').addEventListener('click', () => navigate('new-application'));
}

/* ----------------------------------------------------------------
   Data loaders
   ---------------------------------------------------------------- */
async function loadProfile() {
  const data = await api.get('/api/profile');
  state.profile = data.profile;
  return state.profile;
}

async function loadApplications() {
  const data = await api.get('/api/applications');
  state.applications = data.applications;
  return state.applications;
}

function profileCompleteness(profile) {
  const checks = [
    Boolean(profile.personalInfo && profile.personalInfo.summary),
    (profile.skills || []).length > 0,
    (profile.experience || []).length > 0,
    (profile.education || []).length > 0,
    (profile.projects || []).length > 0,
    (profile.certifications || []).length > 0,
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

function isProfileEmpty(profile) {
  if (!profile) return true;
  const hasSkills = profile.skills && profile.skills.length > 0;
  const hasExp = profile.experience && profile.experience.length > 0;
  return !hasSkills && !hasExp;
}

function promptProfileCompletion() {
  showModal({
    title: 'Profile Incomplete',
    content: 'You need to complete your profile or upload a CV to receive an ATS match score for applications.',
    actions: [
      { label: 'Fill manually', onClick: () => navigate('profile') },
      { label: 'Upload CV', primary: true, onClick: () => { navigate('profile'); setTimeout(() => document.querySelector('[data-tab="upload"]')?.click(), 100); } }
    ]
  });
}

/* ----------------------------------------------------------------
   Dashboard
   ---------------------------------------------------------------- */
function dashboardSkeleton() {
  shell(`
    <div class="dash">
      <div class="dash-left">
        <div class="skel hero"></div>
        <div class="tile-row">
          <div class="skel tile"></div><div class="skel tile"></div>
          <div class="skel tile"></div><div class="skel tile"></div>
        </div>
        <div class="skel" style="height:200px;border-radius:var(--r-card)"></div>
      </div>
      <div class="dash-right">
        <div class="skel block"></div><div class="skel block"></div>
        <div class="skel block"></div>
        <div class="skel" style="height:220px;border-radius:var(--r-card)"></div>
      </div>
    </div>`);
}

function profileSkeleton() {
  shell(`
    <div class="page-title">
      <div class="skel" style="width: 150px; height: 32px; border-radius: 4px;"></div>
    </div>
    <div class="panel">
      <div class="grid two">
        <div class="skel tile"></div><div class="skel tile"></div>
        <div class="skel tile"></div><div class="skel tile"></div>
      </div>
      <div class="skel hero" style="margin-top: 20px;"></div>
    </div>
  `);
}

function applicationDetailSkeleton() {
  shell(`
    <div class="page-title" style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;">
      <div>
        <div class="skel" style="width: 250px; height: 32px; margin-bottom: 8px;"></div>
        <div class="skel" style="width: 150px; height: 20px;"></div>
      </div>
    </div>
    <div class="detail-stack">
      <section class="panel"><div class="skel hero"></div></section>
      <section class="panel"><div class="skel hero"></div></section>
    </div>
  `);
}

const TILE_COLORS = ['amber', 'coral', 'teal', 'slate'];

function applicationTile(item, index) {
  const score = item.ats_match_score || 0;
  const trend = score >= 45 ? '▲' : '▼';
  const band = score >= 75 ? 'Strong match' : score >= 45 ? 'Partial match' : 'Low match';
  return `
    <button class="tile ${TILE_COLORS[index % TILE_COLORS.length]}" data-open-app="${item.id}">
      <div class="tile-top">
        <span class="tile-mark">${escapeHtml(initials(item.company))}</span>
        <div class="tile-co">
          <div class="role">${escapeHtml(item.job_title)}</div>
          <div class="org">${escapeHtml(item.company)}</div>
        </div>
      </div>
      <div class="tile-score num">${score}%</div>
      <span class="tile-foot">${trend} ${band}</span>
    </button>`;
}

function buildSparkline(scores) {
  if (scores.length < 2) {
    return '<div class="spark-empty">Score at least two applications to see your ATS trend.</div>';
  }
  const W = 300;
  const H = 150;
  const pad = 12;
  const n = scores.length;
  const x = (i) => pad + (i * (W - 2 * pad)) / (n - 1);
  const y = (v) => H - pad - (v / 100) * (H - 2 * pad);
  const line = scores.map((s, i) => `${x(i).toFixed(1)},${y(s).toFixed(1)}`).join(' ');
  const area = `${pad},${H - pad} ${line} ${(W - pad).toFixed(1)},${H - pad}`;
  const lastX = x(n - 1).toFixed(1);
  const lastY = y(scores[n - 1]).toFixed(1);
  return `
    <svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="ATS score trend across applications">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--accent)" stop-opacity="0.22"/>
          <stop offset="1" stop-color="var(--accent)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <polygon points="${area}" fill="url(#sparkFill)"/>
      <polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      <circle cx="${lastX}" cy="${lastY}" r="3.5" fill="var(--accent)"/>
    </svg>`;
}

function summaryRow(icon, label, value, feature = false) {
  return `
    <div class="summary ${feature ? 'feature' : ''}">
      <span class="s-ico">${icons[icon]}</span>
      <div>
        <div class="s-label">${escapeHtml(label)}</div>
        <div class="s-value num">${escapeHtml(String(value))}</div>
      </div>
    </div>`;
}

function activityRow(item) {
  const score = item.ats_match_score || 0;
  const hasLetter = Boolean(item.generated_cover_letter);
  return `
    <button class="row" data-open-app="${item.id}" data-search="${escapeHtml((item.job_title + ' ' + item.company).toLowerCase())}">
      <span class="row-mark">${escapeHtml(initials(item.company))}</span>
      <div class="row-main">
        <div class="t">${escapeHtml(item.job_title)}</div>
        <div class="s">${escapeHtml(item.company)}${hasLetter ? ' · cover letter ready' : ''}</div>
      </div>
      <div class="row-right">
        <span class="score ${scoreClass(score)} num">${score}%</span>
        <span class="row-date">${new Date(item.created_at).toLocaleDateString()}</span>
      </div>
    </button>`;
}

function buildFunnelChart(funnelData) {
  if (!funnelData || !funnelData.length || funnelData[0].total === 0) {
    return `<div class="spark-empty">No application data yet to build a funnel.</div>`;
  }
  
  const stages = funnelData[0].stages;
  const svgWidth = 400;
  const svgHeight = 220;
  const gap = 4;
  const stageHeight = (svgHeight - gap * (stages.length - 1)) / stages.length;
  
  let html = `<svg class="funnel-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="xMidYMin meet" style="width: 100%; max-width: 400px; display: block; margin: 0 auto;">`;
  const maxCount = stages[0].count || 1;
  let currentY = 0;
  const colors = ['var(--c-primary)', 'var(--accent)', '#10b981'];
  
  stages.forEach((stage, i) => {
    const nextStage = stages[i+1];
    const topWidth = Math.max((stage.count / maxCount) * svgWidth, 60);
    const bottomWidth = nextStage ? Math.max((nextStage.count / maxCount) * svgWidth, 60) : Math.max((stage.count / maxCount) * 0.7 * svgWidth, 40);
    
    const topLeft = (svgWidth - topWidth) / 2;
    const topRight = topLeft + topWidth;
    const bottomLeft = (svgWidth - bottomWidth) / 2;
    const bottomRight = bottomLeft + bottomWidth;
    
    const points = `${topLeft},${currentY} ${topRight},${currentY} ${bottomRight},${currentY + stageHeight} ${bottomLeft},${currentY + stageHeight}`;
    
    html += `<polygon points="${points}" fill="${colors[i] || 'gray'}" opacity="0.8" />`;
    
    const textY = currentY + (stageHeight / 2);
    html += `<text x="${svgWidth / 2}" y="${textY - 6}" fill="#fff" text-anchor="middle" dominant-baseline="middle" font-size="14" font-weight="600">${stage.name}: ${stage.count}</text>`;
    if (i > 0) {
      html += `<text x="${svgWidth / 2}" y="${textY + 10}" fill="rgba(255,255,255,0.9)" text-anchor="middle" dominant-baseline="middle" font-size="11">${stage.conversion}% conversion</text>`;
    }
    
    currentY += stageHeight + gap;
  });
  html += `</svg>`;
  return html;
}

function buildCohortTable(cohortData) {
  if (!cohortData || !cohortData.length) return '';
  let html = `<div style="overflow-x:auto; margin-top: 16px;">
    <table class="data-grid" style="min-width: 100%; font-size: 0.9em;">
      <thead>
        <tr>
          <th style="text-align:left">Channel</th>
          <th>Total</th>
          <th>Applied</th>
          <th>Interviewing</th>
          <th>Offered</th>
        </tr>
      </thead>
      <tbody>`;
    
  cohortData.forEach(row => {
    const formatConv = (stage, i) => i === 0 ? `${stage.count}` : `${stage.count} <span class="muted" style="font-size:0.85em">(${stage.conversion}%)</span>`;
    html += `<tr>
      <td style="text-align:left; font-weight:500;">${escapeHtml(row.groupKey.replace('_', ' '))}</td>
      <td style="text-align:center">${row.total}</td>
      <td style="text-align:center">${formatConv(row.stages[0], 0)}</td>
      <td style="text-align:center">${formatConv(row.stages[1], 1)}</td>
      <td style="text-align:center">${formatConv(row.stages[2], 2)}</td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  return html;
}

async function dashboardView() {
  dashboardSkeleton();

  const [statsData, profile, applications, funnelOverall, funnelCohort] = await Promise.all([
    api.get('/api/applications/stats'),
    loadProfile(),
    loadApplications(),
    api.get('/api/analytics/funnel'),
    api.get('/api/analytics/funnel?groupBy=channel'),
  ]);

  const stats = statsData.stats;
  const recent = applications.slice(0, 4);
  const completeness = profileCompleteness(profile);
  const trendScores = [...applications].reverse().map((a) => a.ats_match_score || 0);

  shell(`
    <div class="dash">
      <div class="dash-left">
        <section class="hero">
          <div class="eyebrow">Average ATS match</div>
          <div class="big">
            <span class="val">${stats.avg_ats_score}</span>
            <span class="pct">%</span>
          </div>
          <div class="sub">Across ${stats.total_applications} application${stats.total_applications === 1 ? '' : 's'} scored against your CV profile.</div>
        </section>

        ${recent.length ? `
          <section>
            <div class="panel-head">
              <h2>Recent applications</h2>
              <button class="link-button" data-route="applications">See all</button>
            </div>
            <div class="tile-row">${recent.map((item, i) => applicationTile(item, i)).join('')}</div>
          </section>` : `
          <section class="panel">
            ${emptyState({ icon: 'briefcase', title: 'No applications yet', message: 'Create your first application from the panel on the right to get an ATS match score.', })}
          </section>`}

        <section class="chart-card">
          <div class="panel-head"><h2>ATS trend</h2><span class="eyebrow">Oldest → newest</span></div>
          ${buildSparkline(trendScores)}
        </section>
        
        <section class="panel">
          <div class="panel-head"><h2>Application Funnel</h2></div>
          ${buildFunnelChart(funnelOverall)}
          ${buildCohortTable(funnelCohort)}
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2>Activity</h2>
            ${applications.length > 3 ? `<button class="link-button" data-route="applications">See more</button>` : ''}
          </div>
          <div class="rows limited" id="activityRows">
            ${applications.length ? applications.map(activityRow).join('') : '<p class="muted">Nothing here yet.</p>'}
          </div>
        </section>
      </div>

      <div class="dash-right">
        ${summaryRow('briefcase', 'Experience entries', (profile.experience || []).length)}
        ${summaryRow('graduation', 'Education entries', (profile.education || []).length)}
        ${summaryRow('layers', 'Skills tracked', (profile.skills || []).length)}
        ${summaryRow('award', 'Profile complete', completeness + '%', true)}

        <section class="action-card">
          <div class="segment" role="tablist">
            <button class="active" data-tab="new" role="tab">New application</button>
            <button data-tab="upload" role="tab">Upload CV</button>
          </div>
          <div id="quickPanel"></div>
        </section>
      </div>
    </div>`);

  wireOpenApp();
  wireSearch('#activityRows');
  wireQuickPanel();

  if (sessionStorage.getItem('just_registered')) {
    sessionStorage.removeItem('just_registered');
    showModal({
      title: 'Welcome to CV Builder!',
      content: 'To get the most out of the platform, please complete your CV profile. You can either upload an existing PDF CV or fill in your details manually so the AI can generate tailored cover letters.',
      actions: [
        { label: 'Fill manually', onClick: () => navigate('profile') },
        { label: 'Upload CV', primary: true, onClick: () => navigate('profile') }
      ]
    });
  }
}

function quickNewForm() {
  return `
    <form class="form" id="quickNewForm">
      <div class="field"><label for="qJobTitle">Job title</label><input id="qJobTitle" name="jobTitle" placeholder="Frontend Engineer" required></div>
      <div class="field"><label for="qCompany">Company</label><input id="qCompany" name="company" placeholder="Acme Corp" required></div>
      <div class="field"><label for="qChannel">Apply Channel</label>
        <select id="qChannel" name="channel">
          <option value="cold_apply">Cold Apply</option>
          <option value="referral">Referral</option>
          <option value="recruiter">Recruiter</option>
          <option value="network">Network/Event</option>
        </select>
      </div>
      <div class="field"><label for="qDesc">Job description</label><textarea id="qDesc" name="jobDescription" placeholder="Paste the description…" required></textarea></div>
      <button class="btn primary block" type="submit">Analyze &amp; score</button>
    </form>`;
}

function quickUploadForm() {
  return `
    <form class="form" id="quickUploadForm">
      <div class="field">
        <label for="qFile">CV PDF</label>
        <input id="qFile" name="cvFile" type="file" accept="application/pdf" required>
        <span class="hint">We extract the text and let AI structure your profile.</span>
      </div>
      <button class="btn primary block" type="submit">Parse with AI</button>
    </form>`;
}

function wireQuickPanel() {
  const panel = document.querySelector('#quickPanel');
  if (!panel) return;
  const tabs = document.querySelectorAll('.action-card [data-tab]');

  const showNew = () => {
    panel.innerHTML = quickNewForm();
    document.querySelector('#quickNewForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const formTarget = event.currentTarget;
      const submitBtn = formTarget.querySelector('button[type="submit"]');
      const restoreBtn = setBtnLoading(submitBtn, 'Loading...');
      
      const profile = await loadProfile();
      if (isProfileEmpty(profile)) {
        restoreBtn();
        promptProfileCompletion();
        return;
      }
      restoreBtn();

      const body = Object.fromEntries(new FormData(formTarget).entries());
      try {
        const data = await runWithLoader('Scoring your application', [
          'Saving the application…',
          'Comparing against your CV…',
          'Scoring the match…',
          'Listing missing skills…',
        ], (signal) => api.post('/api/applications', body, { signal }));
        
        if (data.application.ats_match_score < 30) {
          showModal({
            title: 'Low ATS Match',
            content: 'Your ATS score is ' + data.application.ats_match_score + "%. Your skills don't match the job description well. Do you want to reconsider this application or continue anyway?",
            actions: [
              { label: 'Reconsider', onClick: () => {} },
              { label: 'Continue anyway', primary: true, onClick: () => {
                showToast('Application scored.');
                navigate('application:' + data.application.id);
              }}
            ]
          });
        } else {
          showToast('Application scored.');
          navigate('application:' + data.application.id);
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  };

  const showUpload = () => {
    panel.innerHTML = quickUploadForm();
    document.querySelector('#quickUploadForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      try {
        await runWithLoader('Parsing your CV', [
          'Reading your CV…',
          'Extracting experience…',
          'Structuring skills…',
          'Finalizing profile…',
        ], (signal) => api.request('/api/profile/upload', { method: 'POST', body: formData, timeout: 120000, signal }));
        showToast('CV parsed and saved.');
        await dashboardView();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.toggle('active', t === tab));
      if (tab.dataset.tab === 'upload') showUpload();
      else showNew();
    });
  });

  showNew();
}

/* ----------------------------------------------------------------
   Profile builder
   ---------------------------------------------------------------- */
function inputField(name, label, value = '', type = 'text') {
  return `
    <div class="field">
      <label for="${name}">${label}</label>
      <input id="${name}" name="${name}" type="${type}" value="${escapeHtml(value)}">
    </div>`;
}

function textareaField(name, label, value = '') {
  return `
    <div class="field">
      <label for="${name}">${label}</label>
      <textarea id="${name}" name="${name}">${escapeHtml(value)}</textarea>
    </div>`;
}

function renderExperienceCard(item = {}) {
  return `
    <div class="dynamic-card experience-card" style="border: 1px solid var(--border); padding: 15px; margin-bottom: 15px; border-radius: 8px; background: var(--surface-2); position: relative;">
      <button type="button" class="btn ghost remove-card-btn" style="position: absolute; top: 10px; right: 10px; color: var(--error); padding: 4px; width: 32px; height: 32px; min-width: 32px; line-height: 1; border-color: transparent;" title="Remove">✕</button>
      <div class="grid two" style="margin-bottom: 10px;">
        <div class="field" style="margin: 0;"><label>Title</label><input type="text" class="exp-title" value="${escapeHtml(item.title || '')}" required></div>
        <div class="field" style="margin: 0;"><label>Company</label><input type="text" class="exp-company" value="${escapeHtml(item.company || '')}" required></div>
      </div>
      <div class="grid two" style="margin-bottom: 10px;">
        <div class="field" style="margin: 0;"><label>Start Date</label><input type="text" class="exp-start" value="${escapeHtml(item.startDate || '')}"></div>
        <div class="field" style="margin: 0;"><label>End Date</label><input type="text" class="exp-end" value="${escapeHtml(item.endDate || '')}"></div>
      </div>
      <div class="field" style="margin: 0;">
        <label>Description</label>
        <textarea class="exp-desc" rows="3">${escapeHtml(item.description || '')}</textarea>
      </div>
    </div>`;
}

function renderEducationCard(item = {}) {
  return `
    <div class="dynamic-card education-card" style="border: 1px solid var(--border); padding: 15px; margin-bottom: 15px; border-radius: 8px; background: var(--surface-2); position: relative;">
      <button type="button" class="btn ghost remove-card-btn" style="position: absolute; top: 10px; right: 10px; color: var(--error); padding: 4px; width: 32px; height: 32px; min-width: 32px; line-height: 1; border-color: transparent;" title="Remove">✕</button>
      <div class="grid two" style="margin-bottom: 10px;">
        <div class="field" style="margin: 0;"><label>Degree</label><input type="text" class="edu-degree" value="${escapeHtml(item.degree || '')}" required></div>
        <div class="field" style="margin: 0;"><label>Institution</label><input type="text" class="edu-institution" value="${escapeHtml(item.institution || '')}" required></div>
      </div>
      <div class="grid two" style="margin-bottom: 10px;">
        <div class="field" style="margin: 0;"><label>Start Year</label><input type="text" class="edu-start" value="${escapeHtml(item.startYear || '')}"></div>
        <div class="field" style="margin: 0;"><label>End Year</label><input type="text" class="edu-end" value="${escapeHtml(item.endYear || '')}"></div>
      </div>
    </div>`;
}

function profileForm(profile = {}) {
  const personal = profile.personalInfo || {};
  const prefs = profile.careerPreferences || {};
  return `
    <form class="form" id="profileForm">
      <div class="grid two">
        ${inputField('fullName', 'Full name', personal.fullName)}
        ${inputField('email', 'Email', personal.email || state.user.email, 'email')}
        ${inputField('phone', 'Phone', personal.phone)}
        ${inputField('location', 'Location', personal.location)}
        ${inputField('targetRole', 'Target role', prefs.targetRole)}
        ${inputField('experienceLevel', 'Experience level', prefs.experienceLevel)}
      </div>
      ${textareaField('industries', 'Industries (one per line)', arrayToLines(prefs.industries))}
      ${textareaField('summary', 'Professional summary', personal.summary)}
      ${textareaField('skills', 'Skills (one per line)', arrayToLines(profile.skills))}
      
      <div id="skillLevelsContainer" style="display: none; margin-bottom: 15px; padding: 15px; background: var(--surface-2); border-radius: 8px; border: 1px solid var(--border);">
        <label style="display: block; margin-bottom: 10px; font-weight: 500;">Skill Proficiency Levels</label>
        <div id="skillLevelsList" class="grid two" style="margin-top: 10px;"></div>
      </div>
      
      <div class="field">
        <label>Experience</label>
        <div id="experienceList"></div>
        <button type="button" class="btn ghost" id="addExperienceBtn" style="margin-top: 10px; justify-self: start;">${icons.plus} Add Experience</button>
      </div>

      <div class="field">
        <label>Education</label>
        <div id="educationList"></div>
        <button type="button" class="btn ghost" id="addEducationBtn" style="margin-top: 10px; justify-self: start;">${icons.plus} Add Education</button>
      </div>

      ${textareaField('projects', 'Projects — title | type | tools | outcome | link', objectsToLines(profile.projects, ['title', 'type', 'tools', 'outcome', 'link']))}
      ${textareaField('certifications', 'Certifications — name | issuer | year', objectsToLines(profile.certifications, ['name', 'issuer', 'year']))}
      <div class="actions">
        <button class="btn primary" type="submit">Save profile</button>
        <button class="btn" type="button" id="summaryBtn">${icons.spark} Generate summary</button>
      </div>
    </form>`;
}

function readProfileForm(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const experience = [];
  form.querySelectorAll('.experience-card').forEach(card => {
    experience.push({
      title: card.querySelector('.exp-title').value.trim(),
      company: card.querySelector('.exp-company').value.trim(),
      startDate: card.querySelector('.exp-start').value.trim(),
      endDate: card.querySelector('.exp-end').value.trim(),
      description: card.querySelector('.exp-desc').value.trim()
    });
  });

  const education = [];
  form.querySelectorAll('.education-card').forEach(card => {
    education.push({
      degree: card.querySelector('.edu-degree').value.trim(),
      institution: card.querySelector('.edu-institution').value.trim(),
      startYear: card.querySelector('.edu-start').value.trim(),
      endYear: card.querySelector('.edu-end').value.trim()
    });
  });

  return {
    personalInfo: {
      fullName: data.fullName.trim(),
      email: data.email.trim(),
      phone: data.phone.trim(),
      location: data.location.trim(),
      summary: data.summary.trim(),
    },
    careerPreferences: {
      targetRole: data.targetRole.trim(),
      experienceLevel: data.experienceLevel.trim(),
      industries: linesToArray(data.industries),
      cvTone: 'Formal',
    },
    skills: linesToArray(data.skills),
    experience,
    education,
    projects: linesToObjects(data.projects, ['title', 'type', 'tools', 'outcome', 'link']),
    certifications: linesToObjects(data.certifications, ['name', 'issuer', 'year']),
    skillLevels: (state.profile && state.profile.skillLevels) || {},
  };
}

async function profileView() {
  profileSkeleton();
  const profile = await loadProfile();
  const skills = profile.skills || [];
  shell(`
    <div class="page-title">
      <h1>Profile</h1>
      <p>Structured CV data that powers ATS scoring, summaries, and PDF export.</p>
    </div>
    <div class="split">
      <section class="panel">
        <div class="panel-head"><h2>CV profile</h2></div>
        ${profileForm(profile)}
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Upload a CV PDF</h2></div>
        <form class="form" id="uploadForm">
          <div class="field">
            <label for="cvFile">PDF file</label>
            <input id="cvFile" name="cvFile" type="file" accept="application/pdf" required>
            <span class="hint">AI reads the file and fills the profile fields for you.</span>
          </div>
          <button class="btn primary" type="submit">Parse with AI</button>
        </form>
        <hr>
        <h3>Current skills</h3>
        <div class="tag-list">${skills.map((skill) => `<span class="tag">${escapeHtml(skill)}</span>`).join('') || '<span class="muted">No skills saved yet.</span>'}</div>
      </section>
    </div>`);

  // Wire dynamic form lists
  const expList = document.getElementById('experienceList');
  const addExpBtn = document.getElementById('addExperienceBtn');
  if (profile.experience && profile.experience.length > 0) {
    profile.experience.forEach(item => expList.insertAdjacentHTML('beforeend', renderExperienceCard(item)));
  }
  addExpBtn.addEventListener('click', () => {
    expList.insertAdjacentHTML('beforeend', renderExperienceCard());
  });

  const eduList = document.getElementById('educationList');
  const addEduBtn = document.getElementById('addEducationBtn');
  if (profile.education && profile.education.length > 0) {
    profile.education.forEach(item => eduList.insertAdjacentHTML('beforeend', renderEducationCard(item)));
  }
  addEduBtn.addEventListener('click', () => {
    eduList.insertAdjacentHTML('beforeend', renderEducationCard());
  });

  // Delegate remove card events
  document.getElementById('profileForm').addEventListener('click', (e) => {
    if (e.target.closest('.remove-card-btn')) {
      e.target.closest('.dynamic-card').remove();
    }
  });

  // Skill levels UI
  const updateSkillLevelsUI = () => {
    const skillsText = document.getElementById('skills').value;
    const currentSkills = linesToArray(skillsText);
    const container = document.getElementById('skillLevelsContainer');
    const list = document.getElementById('skillLevelsList');
    
    if (currentSkills.length === 0) {
      container.style.display = 'none';
      return;
    }
    
    container.style.display = 'block';
    const existingSelects = Array.from(list.querySelectorAll('select')).reduce((acc, sel) => {
      acc[sel.dataset.skill] = sel.value;
      return acc;
    }, state.profile && state.profile.skillLevels ? state.profile.skillLevels : {});
    
    list.innerHTML = currentSkills.map(skill => `
      <div class="field" style="margin: 0;">
        <label style="font-size: 12px; color: var(--muted); margin-bottom: 4px;">${escapeHtml(skill)}</label>
        <select class="skill-level-select" data-skill="${escapeHtml(skill)}" style="padding: 6px; font-size: 13px;">
          <option value="Beginner" ${existingSelects[skill] === 'Beginner' ? 'selected' : ''}>Beginner</option>
          <option value="Intermediate" ${existingSelects[skill] === 'Intermediate' || !existingSelects[skill] ? 'selected' : ''}>Intermediate</option>
          <option value="Advanced" ${existingSelects[skill] === 'Advanced' ? 'selected' : ''}>Advanced</option>
          <option value="Expert" ${existingSelects[skill] === 'Expert' ? 'selected' : ''}>Expert</option>
        </select>
      </div>
    `).join('');
  };

  const skillsInput = document.getElementById('skills');
  let debounceTimer;
  skillsInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(updateSkillLevelsUI, 400);
  });
  updateSkillLevelsUI(); // Initial render

  document.querySelector('#profileForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const restore = setBtnLoading(event.currentTarget.querySelector('button[type="submit"]'), 'Saving…');
    try {
      // Collect skill levels
      const levels = {};
      document.querySelectorAll('.skill-level-select').forEach(sel => {
        levels[sel.dataset.skill] = sel.value;
      });

      const data = await api.put('/api/profile', readProfileForm(event.currentTarget));
      
      // Save skill levels if any exist
      if (Object.keys(levels).length > 0) {
        await api.put('/api/profile/skill-levels', { levels });
      }

      state.profile = data.profile;
      // update state profile skill levels to reflect the locally saved ones since the first PUT doesn't return them properly
      state.profile.skillLevels = levels;

      showToast('Profile saved.');
      navigate('dashboard');
    } catch (err) {
      showToast(err.message, 'error');
      restore();
    }
  });

  document.querySelector('#summaryBtn').addEventListener('click', async () => {
    try {
      const current = readProfileForm(document.querySelector('#profileForm'));
      await api.put('/api/profile', current);
      const data = await runWithLoader('Generating summary', [
        'Reviewing your profile…',
        'Drafting a summary…',
        'Polishing the wording…',
      ], (signal) => api.post('/api/profile/summary', {}, { signal }));
      state.profile = data.profile;
      showToast('Summary generated.');
      await profileView();
    } catch (err) {
      if (err.message === 'Request cancelled by user.') {
        showToast('Cancelled.', 'info');
      } else {
        showToast(err.message, 'error');
      }
    }
  });

  document.querySelector('#uploadForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      const data = await runWithLoader('Parsing your CV', [
        'Reading your CV…',
        'Extracting experience…',
        'Structuring skills…',
        'Finalizing profile…',
      ], (signal) => api.request('/api/profile/upload', { method: 'POST', body: formData, timeout: 120000, signal }));
      state.profile = data.profile;
      showToast('CV parsed and saved.');
      await profileView();
    } catch (err) {
      if (err.message === 'Request cancelled by user.') {
        showToast('Cancelled.', 'info');
      } else {
        showToast(err.message, 'error');
      }
    }
  });

  // Feature 6: Linter overlay sync
  const expEl = document.querySelector('#experience');
  const overlayEl = document.querySelector('#experienceLintOverlay');
  
  if (expEl && overlayEl) {
    let lintTimer = null;
    
    const applyLinting = (text, issues) => {
      if (!issues || issues.length === 0) {
        overlayEl.innerHTML = escapeHtml(text) + '\n';
        return;
      }
      
      let html = '';
      let lastIndex = 0;
      
      issues.forEach(issue => {
        if (issue.startIndex >= lastIndex) {
          html += escapeHtml(text.substring(lastIndex, issue.startIndex));
          html += `<span class="lint-error" title="${escapeHtml(issue.suggestion)}">${escapeHtml(text.substring(issue.startIndex, issue.startIndex + issue.length))}</span>`;
          lastIndex = issue.startIndex + issue.length;
        }
      });
      html += escapeHtml(text.substring(lastIndex)) + '\n';
      overlayEl.innerHTML = html;
    };

    const triggerLint = () => {
      const text = expEl.value;
      if (!text.trim()) {
        overlayEl.innerHTML = '';
        return;
      }
      
      clearTimeout(lintTimer);
      lintTimer = setTimeout(async () => {
        try {
          const res = await api.post('/api/profile/lint', { text });
          applyLinting(text, res.issues || []);
        } catch (e) {
          // Linting is a non-critical background aid. On failure, fall back to
          // plain (un-highlighted) text so nothing stale or misleading is shown.
          overlayEl.innerHTML = escapeHtml(expEl.value) + '\n';
        }
      }, 500);
      
      // Update text instantly without highlights to avoid lag
      overlayEl.innerHTML = escapeHtml(text) + '\n';
    };

    expEl.addEventListener('input', triggerLint);
    expEl.addEventListener('scroll', () => {
      overlayEl.scrollTop = expEl.scrollTop;
    });
    
    // Initial run
    triggerLint();
  }
}

/* ----------------------------------------------------------------
   CV PDF + skill levels
   ---------------------------------------------------------------- */
async function cvView() {
  const profile = await loadProfile();
  const skills = profile.skills || [];
  shell(`
    <div class="page-title">
      <h1>CV document</h1>
      <p>Set skill levels and download a generated CV in your chosen template.</p>
    </div>
    <section class="panel">
      <form class="form" id="cvForm">
        <div class="field" style="max-width:320px">
          <label for="template">Template</label>
          <select id="template" name="template">
            <option value="modern" ${profile.preferences?.defaultTemplate === 'modern' ? 'selected' : ''}>Modern</option>
            <option value="classic" ${profile.preferences?.defaultTemplate === 'classic' ? 'selected' : ''}>Classic</option>
            <option value="bold" ${profile.preferences?.defaultTemplate === 'bold' ? 'selected' : ''}>Bold</option>
          </select>
        </div>
        ${skills.length ? `
          <h3>Skill levels</h3>
          <div class="section-list">
            ${skills.map((skill, i) => `
              <div class="section-item">
                <div class="field">
                  <label for="level-${i}">${escapeHtml(skill)}</label>
                  <select id="level-${i}" name="${escapeHtml(skill)}">
                    ${['Familiar', 'Proficient', 'Advanced'].map((level) => `<option value="${level}" ${(profile.skillLevels || {})[skill] === level ? 'selected' : ''}>${level}</option>`).join('')}
                  </select>
                </div>
              </div>`).join('')}
          </div>` : emptyState({ icon: 'layers', title: 'No skills yet', message: 'Add skills to your profile before setting skill levels.', actionLabel: 'Go to profile', actionRoute: 'profile' })}
        <div class="actions">
          <button class="btn" type="submit">Save skill levels</button>
          <button class="btn primary" type="button" id="downloadCv">${icons.download} Download CV PDF</button>
        </div>
      </form>
    </section>`);

  document.querySelectorAll('[data-route]').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.route)));

  document.querySelector('#cvForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const levels = {};
    skills.forEach((skill) => {
      levels[skill] = form.get(skill);
    });
    const restore = setBtnLoading(event.submitter, 'Saving…');
    try {
      const data = await api.put('/api/profile/skill-levels', { levels });
      state.profile = data.profile;
      showToast('Skill levels saved.');
    } catch (err) {
      if (err.message === 'Request cancelled by user.') {
        showToast('Cancelled.', 'info');
      } else {
        showToast(err.message, 'error');
      }
    } finally {
      restore();
    }
  });

  document.querySelector('#downloadCv').addEventListener('click', async () => {
    const template = document.querySelector('#template').value;
    await downloadFile(`/api/profile/cv.pdf?download=1&template=${encodeURIComponent(template)}`, 'cv.pdf');
  });
}

/* ----------------------------------------------------------------
   Applications list
   ---------------------------------------------------------------- */
async function applicationsView() {
  if (window.renderDataGrid) {
    await window.renderDataGrid();
  } else {
    showToast('Data grid script not loaded.', 'error');
  }
}

async function newApplicationView() {
  shell(`
    <div class="page-title">
      <h1>New application</h1>
      <p>Paste a job description — it is scored against your saved CV profile.</p>
    </div>
    <section class="panel" style="max-width:640px">
      <form class="form" id="applicationForm">
        ${inputField('jobTitle', 'Job title')}
        ${inputField('company', 'Company')}
        <div class="field">
          <label for="channel">Apply Channel</label>
          <select id="channel" name="channel">
            <option value="cold_apply">Cold Apply</option>
            <option value="referral">Referral</option>
            <option value="recruiter">Recruiter</option>
            <option value="network">Network/Event</option>
          </select>
        </div>
        ${textareaField('jobDescription', 'Job description')}
        <button class="btn primary" type="submit">Create &amp; score</button>
      </form>
    </section>`);

  document.querySelector('#applicationForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formTarget = event.currentTarget;
    const submitBtn = formTarget.querySelector('button[type="submit"]');
    const restoreBtn = setBtnLoading(submitBtn, 'Loading...');

    try {
      const profile = await loadProfile();
      if (isProfileEmpty(profile)) {
        restoreBtn();
        promptProfileCompletion();
        return;
      }
      restoreBtn();

      const body = Object.fromEntries(new FormData(formTarget).entries());
      const data = await runWithLoader('Scoring your application', [
        'Saving the application…',
        'Comparing against your CV…',
        'Scoring the match…',
        'Listing missing skills…',
      ], (signal) => api.post('/api/applications', body, { signal }));

      if (data.application.ats_match_score < 30) {
        showModal({
          title: 'Low ATS Match',
          content: 'Your ATS score is ' + data.application.ats_match_score + "%. Your skills don't match the job description well. Do you want to reconsider this application or continue anyway?",
          actions: [
            { label: 'Reconsider', onClick: () => {} },
            { label: 'Continue anyway', primary: true, onClick: () => {
              showToast('Application scored.');
              navigate('application:' + data.application.id);
            }}
          ]
        });
      } else {
        showToast('Application scored.');
        navigate('application:' + data.application.id);
      }
    } catch (err) {
      // Always restore the button so it never stays stuck spinning.
      restoreBtn();
      showToast(err.message, 'error');
    }
  });
}

async function applicationDetailView(id) {
  applicationDetailSkeleton();
  const [data, interviewsData] = await Promise.all([
    api.get(`/api/applications/${id}`),
    api.get(`/api/applications/${id}/interviews`).catch(() => ({ interviews: [] }))
  ]);
  const application = data.application;
  const interviews = interviewsData.interviews || [];
  const missing = Array.isArray(application.missing_skills) ? application.missing_skills : [];
  const score = application.ats_match_score || 0;

  shell(`
    <div class="page-title" style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap">
      <div>
        <h1>${escapeHtml(application.job_title)}</h1>
        <p>${escapeHtml(application.company)}</p>
      </div>
      <button class="btn ghost" data-route="applications">${icons.back} Back</button>
    </div>

    <div class="detail-stack">
      <section class="panel">
        <div class="panel-head">
          <h2>Job description</h2>
          <span class="score ${scoreClass(score)} num">${score}% ATS</span>
        </div>
        ${missing.length ? `<div class="jd-missing">
          <span class="jd-missing-label">Missing skills</span>
          <div class="tag-list">${missing.map((skill) => `<span class="tag">${escapeHtml(skill)}</span>`).join('')}</div>
        </div>` : ''}
        ${clampBlock(escapeHtml(application.job_description || 'No description saved.'), 10, 'jd-text')}
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>Cover letter</h2>
          ${application.generated_cover_letter ? `<div class="head-actions">
            <button class="btn ghost" type="button" id="copyLetter">${icons.copy} Copy</button>
            <button class="btn ghost" type="button" id="downloadLetter">${icons.download} PDF</button>
          </div>` : ''}
        </div>
        <form class="form" id="coverForm">
          <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">
            <div class="field" style="flex:1;min-width:150px;margin:0;">
              <label for="selectedTone">Tone</label>
              <select id="selectedTone" name="selectedTone">
                ${['Formal', 'Confident', 'Concise'].map((tone) => `<option value="${tone}" ${application.selected_tone === tone ? 'selected' : ''}>${tone}</option>`).join('')}
              </select>
            </div>
            <button class="btn primary" type="submit" style="margin-bottom:0;">${icons.spark} ${application.generated_cover_letter ? 'Regenerate' : 'Generate'}</button>
          </div>
        </form>
        ${application.generated_cover_letter
          ? `<hr>
             <textarea id="coverLetterText" style="width: 100%; min-height: 300px; padding: 15px; border-radius: 8px; background: var(--surface-2); border: 1px solid var(--border); margin-bottom: 10px; font-family: inherit; line-height: 1.6; resize: vertical;">${escapeHtml(application.generated_cover_letter)}</textarea>
             <button class="btn primary block" id="saveCoverLetterBtn">Save Edits</button>`
          : emptyState({ icon: 'doc', title: 'No cover letter yet', message: 'Pick a tone and generate a cover letter tailored to this role.' })}
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>Tailored CV</h2>
        </div>
        <form class="form" id="tailoredCvForm">
          <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">
            <p style="flex:1; margin:0; color:var(--muted); font-size:14px; line-height:1.5;">
              Automatically rewrite and re-order your CV bullets to highlight the most relevant experience for this specific job description.
            </p>
            <button class="btn primary" type="submit" style="margin-bottom:0;">
              ${icons.spark} ${application.tailored_cv_profile ? 'Regenerate CV' : 'Optimize CV for this Job'}
            </button>
          </div>
        </form>
        ${application.tailored_cv_profile && application.tailored_cv_profile.experience
          ? `<hr>
             <h3 style="margin-top: 15px; font-size: 14px; color: var(--accent);">Review Tailored Bullet Points</h3>
             <div class="tailored-preview" style="background: var(--surface-2); padding: 15px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 15px; max-height: 400px; overflow-y: auto;">
               ${application.tailored_cv_profile.experience.map(exp => `
                 <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid var(--border);">
                   <strong>${escapeHtml(exp.title)} at ${escapeHtml(exp.company)}</strong>
                   <div style="color: var(--muted); margin-top: 8px; white-space: pre-wrap; font-size: 13px; line-height: 1.5;">${escapeHtml(exp.description)}</div>
                 </div>
               `).join('')}
             </div>
             <button class="btn" type="button" id="downloadTailoredCv" style="background: var(--success); color: #fff; border: none; padding: 8px 16px; box-shadow: 0 4px 12px rgba(34,197,94,0.3); border-radius: 6px; font-weight: 500;">
               ${icons.download} Download PDF
             </button>`
          : ''}
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>Interview Prep</h2>
        </div>
        <form class="form" id="interviewPrepForm">
          <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">
            <p style="flex:1; margin:0; color:var(--muted); font-size:14px; line-height:1.5;">
              Generate likely interview questions and suggested answers pulling directly from your CV experience.
            </p>
            <button class="btn primary" type="submit" style="margin-bottom:0;">
              ${icons.spark} ${application.interview_prep_guide ? 'Regenerate Flashcards' : 'Generate Flashcards'}
            </button>
          </div>
        </form>
        ${application.interview_prep_guide && Array.isArray(application.interview_prep_guide)
          ? `<hr><div class="flashcard-grid" style="display: grid; gap: 16px; margin-top: 24px;">
              ${application.interview_prep_guide.map((q, i) => `
                <details class="flashcard" style="background: var(--surface-2); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; cursor: pointer;">
                  <summary style="padding: 16px; font-weight: 500; list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 16px;">
                    <span style="display: flex; align-items: center; gap: 12px;">
                      <span style="background: var(--c-primary); color: #fff; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; flex-shrink: 0;">${i+1}</span>
                      ${escapeHtml(q.question)}
                    </span>
                    <span class="tag" style="background: var(--surface-1);">${escapeHtml(q.type)}</span>
                  </summary>
                  <div style="padding: 16px; border-top: 1px solid var(--border); background: var(--surface-1); color: var(--muted); line-height: 1.6;">
                    <strong style="color: #fff; display: block; margin-bottom: 8px;">Suggested Answer Strategy:</strong>
                    ${escapeHtml(q.suggested_answer)}
                  </div>
                </details>
              `).join('')}
             </div>`
          : emptyState({ icon: 'doc', title: 'No Prep Guide Yet', message: 'Generate flashcards to prep for this interview.' })}
      </section>

      <div class="detail-standout">
        <section class="standout-card standout-card--schedule">
          <div class="standout-head">
            <span class="standout-icon">${icons.calendar}</span>
            <div class="standout-title">
              <h2>Interviews</h2>
              <p>${interviews.length ? `${interviews.length} scheduled` : 'None scheduled yet'}</p>
            </div>
            <button class="btn primary" id="newInterviewBtn">${icons.plus} Schedule</button>
          </div>
          <div id="interviewConflictWarning" class="standout-alert" style="display:none;">
            <strong>${icons.alert} Scheduling conflict</strong>
            <span id="interviewConflictText"></span>
          </div>
          <form id="newInterviewForm" class="form standout-form" style="display:none;">
            <div class="grid two">
              <div class="field">
                <label for="intTitle">Title</label>
                <input id="intTitle" name="title" type="text" value="" placeholder="e.g. Technical Screen">
              </div>
              <div class="field">
                <label for="intLocation">Location / Link</label>
                <input id="intLocation" name="location" type="text" value="">
              </div>
            </div>
            <div class="grid two">
              <div class="field">
                <label for="intStart">Start Time</label>
                <input type="datetime-local" id="intStart" name="startTime" required>
              </div>
              <div class="field">
                <label for="intEnd">End Time</label>
                <input type="datetime-local" id="intEnd" name="endTime" required>
              </div>
            </div>
            <div class="field">
              <label for="intNotes">Notes</label>
              <textarea id="intNotes" name="notes"></textarea>
            </div>
            <div class="actions">
              <button class="btn ghost" type="button" id="cancelInterviewBtn">Cancel</button>
              <button class="btn primary" type="submit" id="saveInterviewBtn">Save Interview</button>
            </div>
          </form>
          ${interviews.length ? `<div class="standout-list">
            ${interviews.map(inv => `
              <div class="standout-item">
                <div class="standout-item-main">
                  <div class="standout-item-title">${escapeHtml(inv.title)}</div>
                  <div class="standout-item-sub">${new Date(inv.start_time).toLocaleString()} – ${new Date(inv.end_time).toLocaleTimeString()}${inv.location ? ' · ' + escapeHtml(inv.location) : ''}</div>
                </div>
                <button class="btn ghost" data-ics="${inv.id}">${icons.calendar} .ics</button>
              </div>
            `).join('')}
          </div>` : `<p class="standout-empty">Schedule your interview rounds to track dates and download calendar invites.</p>`}
        </section>

        <section class="standout-card standout-card--flags">
          <div class="standout-head">
            <span class="standout-icon standout-icon--flags">${icons.alert}</span>
            <div class="standout-title">
              <h2>Red flags</h2>
              <p>${(application.red_flags && application.red_flags.length) ? `${application.red_flags.length} detected` : 'Posting looks clean'}</p>
            </div>
            <span class="red-flag-score ${redFlagScoreClass(application.red_flag_score || 0)} num">${application.red_flag_score || 0}</span>
          </div>
          ${(application.red_flags && application.red_flags.length > 0) ? `
            <div class="standout-list">
              ${application.red_flags.map(flag => `
                <div class="flag-item">
                  <strong>${escapeHtml(flag.rule)} <span class="flag-weight">+${flag.weight}</span></strong>
                  <span>${escapeHtml(flag.reason)}</span>
                </div>
              `).join('')}
            </div>
          ` : `<p class="standout-empty">No manipulative or scam-like language was detected in this posting.</p>`}
        </section>
      </div>
    </div>`);

  document.querySelectorAll('[data-route]').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.route)));

  document.querySelector('#coverForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      await runWithLoader('Writing your cover letter', [
        'Reading the job description…',
        'Matching your experience…',
        'Writing the letter…',
        'Refining the tone…',
      ], (signal) => api.post(`/api/applications/${id}/cover-letter`, body, { signal }));
      showToast('Cover letter generated.');
      await applicationDetailView(id);
    } catch (err) {
      if (err.message === 'Request cancelled by user.') {
        showToast('Cancelled.', 'info');
      } else {
        showToast(err.message, 'error');
      }
    }
  });

  const downloadButton = document.querySelector('#downloadLetter');
  if (downloadButton) {
    downloadButton.addEventListener('click', () => downloadFile(`/api/applications/${id}/cover-letter.pdf`, 'cover-letter.pdf'));
  }

  const copyButton = document.querySelector('#copyLetter');
  if (copyButton) {
    copyButton.addEventListener('click', async () => {
      const taElem = document.querySelector('#coverLetterText');
      const text = taElem ? taElem.value : (application.generated_cover_letter || '');
      try {
        await navigator.clipboard.writeText(text);
      } catch (err) {
        // Fallback for browsers/contexts without the async clipboard API.
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      const original = copyButton.innerHTML;
      copyButton.innerHTML = `${icons.check} Copied`;
      copyButton.disabled = true;
      setTimeout(() => { copyButton.innerHTML = original; copyButton.disabled = false; }, 1600);
      showToast('Cover letter copied to clipboard.');
    });
  }

  const saveCoverLetterBtn = document.querySelector('#saveCoverLetterBtn');
  if (saveCoverLetterBtn) {
    saveCoverLetterBtn.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const restore = setBtnLoading(btn, 'Saving...');
      const updatedText = document.querySelector('#coverLetterText').value;
      try {
        await api.patch(`/api/applications/${id}`, { generated_cover_letter: updatedText });
        showToast('Cover letter updated successfully.');
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        restore();
      }
    });
  }

  const tailoredCvForm = document.querySelector('#tailoredCvForm');
  if (tailoredCvForm) {
    tailoredCvForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await runWithLoader('Optimizing your CV', [
          'Analyzing job requirements…',
          'Cross-referencing your experience…',
          'Rewriting bullet points for impact…',
          'Finalizing ATS compliance…',
        ], (signal) => api.post(`/api/applications/${id}/tailor-cv`, {}, { signal }));
        showToast('CV optimized for this job.');
        await applicationDetailView(id);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  const downloadTailoredCvBtn = document.querySelector('#downloadTailoredCv');
  if (downloadTailoredCvBtn) {
    downloadTailoredCvBtn.addEventListener('click', () => downloadFile(`/api/applications/${id}/tailored-cv.pdf`, 'tailored-cv.pdf'));
  }

  const interviewPrepForm = document.querySelector('#interviewPrepForm');
  if (interviewPrepForm) {
    interviewPrepForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await runWithLoader('Preparing interview strategy', [
          'Predicting likely questions…',
          'Finding examples from your past…',
          'Formulating STAR method answers…',
        ], (signal) => api.post(`/api/applications/${id}/interview-prep`, {}, { signal }));
        showToast('Interview flashcards generated.');
        await applicationDetailView(id);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Truncate long blocks (job description, cover letter) with a See more/less toggle.
  wireClamps();

  // Interview wiring
  document.querySelectorAll('[data-ics]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const invId = btn.dataset.ics;
      downloadFile(`/api/interviews/${invId}/ics`, `interview-${invId}.ics`);
    });
  });

  const newIntBtn = document.querySelector('#newInterviewBtn');
  const cancelIntBtn = document.querySelector('#cancelInterviewBtn');
  const intForm = document.querySelector('#newInterviewForm');
  const intWarning = document.querySelector('#interviewConflictWarning');
  const intWarningText = document.querySelector('#interviewConflictText');
  let conflictIgnored = false; // Flag to track if user has already seen warning and clicked save again

  if (newIntBtn) {
    newIntBtn.addEventListener('click', () => {
      intForm.style.display = 'block';
      newIntBtn.style.display = 'none';
      intWarning.style.display = 'none';
      conflictIgnored = false;
    });
  }
  
  if (cancelIntBtn) {
    cancelIntBtn.addEventListener('click', () => {
      intForm.style.display = 'none';
      newIntBtn.style.display = 'inline-block';
      intForm.reset();
      intWarning.style.display = 'none';
      conflictIgnored = false;
    });
  }

  if (intForm) {
    intForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const body = Object.fromEntries(new FormData(event.currentTarget).entries());
      const submitBtn = document.querySelector('#saveInterviewBtn');
      const restoreBtn = setBtnLoading(submitBtn, 'Saving…');

      try {
        // If they haven't ignored the conflict warning, check for conflict first
        if (!conflictIgnored) {
          const conflictData = await api.post('/api/interviews/check-conflict', { startTime: body.startTime, endTime: body.endTime });
          if (conflictData.hasConflict) {
            intWarningText.textContent = `This time overlaps with: "${conflictData.conflict.title}" on ${new Date(conflictData.conflict.start_time).toLocaleString()}. Click 'Save Interview' again to ignore and save anyway.`;
            intWarning.style.display = 'block';
            conflictIgnored = true;
            restoreBtn();
            return;
          }
        }

        // Save the interview
        await api.post(`/api/applications/${id}/interviews`, {
          title: body.title,
          location: body.location,
          startTime: body.startTime,
          endTime: body.endTime,
          notes: body.notes
        });
        showToast('Interview scheduled.');
        await applicationDetailView(id);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        restoreBtn();
      }
    });
  }
}

/* ----------------------------------------------------------------
   Shared wiring
   ---------------------------------------------------------------- */
function wireOpenApp() {
  document.querySelectorAll('[data-open-app]').forEach((button) => {
    button.addEventListener('click', () => navigate(`application:${button.dataset.openApp}`));
  });
}

function wireSearch(containerSelector) {
  const input = document.querySelector('#globalSearch');
  const container = document.querySelector(containerSelector);
  if (!input || !container) return;

  input.value = ''; // always reset input when view loads so state is clean

  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    const rows = container.querySelectorAll('[data-search]');

    // Clear previous no-results message
    const prev = container.querySelector('.search-empty');
    if (prev) prev.remove();

    // Always clear hidden first so toggling limited back on works
    rows.forEach((row) => row.classList.remove('hidden'));

    if (query) {
      // Expand to show all rows while searching
      container.classList.remove('limited');
      let visibleCount = 0;
      rows.forEach((row) => {
        if (!row.dataset.search.includes(query)) {
          row.classList.add('hidden');
        } else {
          visibleCount++;
        }
      });
      if (visibleCount === 0) {
        const msg = document.createElement('p');
        msg.className = 'muted search-empty';
        msg.textContent = `No results for "${input.value}"`;
        container.appendChild(msg);
      }
    } else {
      // No query — collapse back to limited (shows first 3 via CSS)
      container.classList.add('limited');
    }
  });
}

async function downloadFile(path, fallbackName) {
  try {
    const blob = await api.get(path);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fallbackName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ----------------------------------------------------------------
   Settings
   ---------------------------------------------------------------- */
async function settingsView() {
  const profile = await loadProfile();
  shell(`
    <div class="page-title">
      <h1>Settings</h1>
      <p>Manage your account details, security, and preferences.</p>
    </div>
    <div class="split">
      <section class="panel">
        <div class="panel-head"><h2>Account Details</h2></div>
        <form class="form" id="detailsForm">
          <div class="field">
            <label for="fullName">Full Name</label>
            <input id="fullName" name="fullName" value="${escapeHtml(state.user.fullName)}" required>
          </div>
          <div class="field">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" value="${escapeHtml(state.user.email)}" required>
          </div>
          <button class="btn primary" type="submit">Update Details</button>
        </form>
      </section>
      
       <section class="panel">
        <div class="panel-head"><h2>Security</h2></div>
        <form class="form" id="passwordForm">
          <input type="text" name="email" value="${escapeHtml(state.user.email)}" autocomplete="username" style="display: none;" readonly>
          <div class="field">
            <label for="currentPassword">Current Password</label>
            <div class="pw-wrap">
              <input id="currentPassword" name="currentPassword" type="password" autocomplete="current-password" required>
              <button class="pw-toggle" type="button" aria-label="Show password">${icons.eye}</button>
            </div>
          </div>
          <div class="field">
            <label for="newPassword">New Password</label>
            <div class="pw-wrap">
              <input id="newPassword" name="newPassword" type="password" autocomplete="new-password" required>
              <button class="pw-toggle" type="button" aria-label="Show password">${icons.eye}</button>
            </div>
          </div>
          <button class="btn primary" type="submit">Change Password</button>
        </form>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>Preferences</h2></div>
        <form class="form" id="prefsForm">
          <div class="field">
            <label for="defaultTemplate">Default CV Template</label>
            <select id="defaultTemplate" name="defaultTemplate">
              <option value="modern" ${profile.preferences?.defaultTemplate === 'modern' ? 'selected' : ''}>Modern</option>
              <option value="classic" ${profile.preferences?.defaultTemplate === 'classic' ? 'selected' : ''}>Classic</option>
              <option value="bold" ${profile.preferences?.defaultTemplate === 'bold' ? 'selected' : ''}>Bold</option>
            </select>
          </div>
          <button class="btn primary" type="submit">Save Preferences</button>
        </form>
      </section>
      <section class="panel" style="border-color: var(--danger);">
        <div class="panel-head"><h2 style="color: var(--danger);">Danger Zone</h2></div>
        <div style="margin-bottom: 12px; color: var(--muted);">Permanently delete your account and all associated data. This action cannot be undone.</div>
        <button class="btn danger" id="deleteAccountBtn">Delete Account</button>
      </section>
    </div>
    <div style="margin-top: 32px; display: flex; justify-content: center; gap: 20px; font-size: 13.5px; color: var(--muted); border-top: 1px solid var(--line); padding-top: 20px;">
      <a href="#terms" style="color: var(--muted); text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--muted)'">Terms & Conditions</a>
      <span>&bull;</span>
      <a href="#privacy" style="color: var(--muted); text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--muted)'">Privacy Policy</a>
    </div>`);

  document.querySelectorAll('[data-route]').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.route)));
  wirePwToggles();

  document.querySelector('#detailsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const restore = setBtnLoading(e.submitter, 'Updating…');
    try {
      const data = await api.put('/api/auth/details', Object.fromEntries(new FormData(form)));
      setAuth(data.token, data.user);
      showToast('Details updated successfully.');
      await settingsView();
    } catch (err) {
      if (err.message === 'Request cancelled by user.') {
        showToast('Cancelled.', 'info');
      } else {
        showToast(err.message, 'error');
      }
    } finally {
      restore();
    }
  });

  document.querySelector('#passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const restore = setBtnLoading(e.submitter, 'Changing…');
    try {
      await api.post('/api/auth/update-password', Object.fromEntries(new FormData(form)));
      showToast('Password changed successfully.');
      form.reset();
    } catch (err) {
      if (err.message === 'Request cancelled by user.') {
        showToast('Cancelled.', 'info');
      } else {
        showToast(err.message, 'error');
      }
    } finally {
      restore();
    }
  });

  document.querySelector('#prefsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const restore = setBtnLoading(e.submitter, 'Saving…');
    try {
      const template = new FormData(form).get('defaultTemplate');
      const prefs = profile.preferences || {};
      prefs.defaultTemplate = template;
      const data = await api.put('/api/profile', { ...profile, preferences: prefs });
      state.profile = data.profile;
      showToast('Preferences saved.');
    } catch (err) {
      if (err.message === 'Request cancelled by user.') {
        showToast('Cancelled.', 'info');
      } else {
        showToast(err.message, 'error');
      }
    } finally {
      restore();
    }
  });

  const deleteBtn = document.querySelector('#deleteAccountBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-dialog" role="dialog" aria-modal="true" style="border-top: 4px solid var(--danger);">
          <div class="modal-head">
            <h2 style="color: var(--danger); display: flex; align-items: center; gap: 8px;">
              ${icons.alert} Delete Account
            </h2>
          </div>
          <div class="modal-body" style="color: var(--muted); line-height: 1.5;">
            <p>You are about to permanently delete your account, CVs, and all associated data.</p>
            <p style="margin-top: 8px; font-weight: 500; color: #fff;">This action cannot be undone.</p>
          </div>
          <div class="modal-actions" style="margin-top: 24px;">
            <button class="btn ghost" id="cancelDeleteBtn">Cancel</button>
            <button class="btn danger" id="confirmDeleteBtn">Yes, Delete Everything</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const close = () => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 200);
      };

      overlay.querySelector('#cancelDeleteBtn').addEventListener('click', close);
      
      const confirmBtn = overlay.querySelector('#confirmDeleteBtn');
      confirmBtn.addEventListener('click', async () => {
        const restore = setBtnLoading(confirmBtn, 'Deleting…');
        // disable cancel button so user can't abort mid-flight
        overlay.querySelector('#cancelDeleteBtn').disabled = true;
        try {
          await api.delete('/api/auth/me');
          showToast('Account deleted successfully.');
          
          // Graceful fade out
          overlay.innerHTML = `
            <div class="modal-dialog" style="text-align: center; padding: 48px;">
              ${icons.check}
              <h3 style="margin-top: 16px;">Account Deleted</h3>
              <p style="color: var(--muted); margin-top: 8px;">Logging you out...</p>
            </div>
          `;
          
          setTimeout(() => {
            close();
            clearAuth();
            authView();
          }, 1500);
          
        } catch (err) {
          showToast(err.message, 'error');
          overlay.querySelector('#cancelDeleteBtn').disabled = false;
          restore();
        }
      });
    });
  }
}

/* ----------------------------------------------------------------
   ATS X-Ray Feature
   ---------------------------------------------------------------- */
async function xrayView() {
  const res = await api.request('/api/xray');
  const versions = res.versions || [];

  shell(`
    <div class="page-title">
      <h1>ATS X-Ray Simulator</h1>
      <p>See exactly how ATS systems extract text from your CV. Highlighted red lines indicate columns, tables, or complex layouts that cause text to scramble.</p>
    </div>
    
    <section class="panel">
      <form class="form" id="xrayUploadForm" style="display: flex; gap: 12px; align-items: flex-end;">
        <div class="field" style="flex: 1; margin: 0;">
          <label for="xrayFile">Test a PDF</label>
          <input id="xrayFile" name="cvFile" type="file" accept="application/pdf" required>
        </div>
        <button class="btn primary" type="submit">Scan with X-Ray</button>
      </form>
      ${versions.length > 0 ? `
        <div style="margin-top: 16px;">
          <label class="muted" style="font-size: 13px; margin-right: 8px;">Previous scans:</label>
          <select id="xrayHistory" style="width: auto; display: inline-block;">
            <option value="">-- Select a past scan --</option>
            ${versions.map(v => `<option value="${v.id}">${escapeHtml(v.file_name)} (${new Date(v.uploaded_at).toLocaleDateString()})</option>`).join('')}
          </select>
        </div>
      ` : ''}
    </section>

    <div id="xrayResult" style="display: none;"></div>
  `);

  const renderReport = async (id, report) => {
    const resultDiv = document.querySelector('#xrayResult');
    resultDiv.style.display = 'block';
    
    let textHtml = '';
    report.stream.forEach(line => {
      if (line.flags && line.flags.length > 0) {
        textHtml += `<span class="xray-flagged-line" title="${escapeHtml(line.flags.join(', '))}">${escapeHtml(line.text)}</span>\n`;
      } else {
        textHtml += `<span class="xray-clean-line">${escapeHtml(line.text)}</span>\n`;
      }
    });

    // The structural checks an ATS parser cares about. Each maps to the risk
    // label(s) that would fail it, so the verdict is derived from the real
    // analysis — a clean scan shows every check ticked, a risky one shows why.
    const CHECK_DEFS = [
      { label: 'Text is machine-readable', fails: ['Scanned or image-based PDF (little or no selectable text)', 'Unreadable PDF'] },
      { label: 'Single-column reading order', fails: ['Complex Multi-Column Layout'] },
      { label: 'No tables or grids', fails: ['Table or Grid Structure'] },
      { label: 'No header or footer traps', fails: ['Repeated Header Trap', 'Repeated Footer Trap'] },
    ];
    const risks = report.risks || [];
    const checks = CHECK_DEFS.map(def => ({
      label: def.label,
      passed: !def.fails.some(f => risks.includes(f)),
    }));
    const passedCount = checks.filter(c => c.passed).length;
    const allClear = risks.length === 0;

    const markPass = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    const markWarn = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';
    const tick = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    const cross = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

    const checksHtml = checks.map(c => `
      <li class="xray-check xray-check--${c.passed ? 'pass' : 'fail'}">
        ${c.passed ? tick : cross}<span>${c.label}</span>
      </li>`).join('');

    const verdictClass = allClear ? 'xray-verdict--pass' : 'xray-verdict--warn';
    const verdictMark = allClear ? markPass : markWarn;
    const verdictTitle = allClear
      ? 'Clean parse — your CV is ATS-ready'
      : `${risks.length} structural risk${risks.length > 1 ? 's' : ''} to review`;
    const verdictSub = allClear
      ? 'Every line was extracted in a single, logical order. An applicant tracking system will read this document exactly the way you laid it out.'
      : 'The layouts below can scramble how an ATS reads your CV. The affected lines are highlighted in the text stream on the right.';

    const risksHtml = `
      <div class="xray-verdict ${verdictClass}">
        <div class="xray-verdict-head">
          <span class="xray-verdict-mark">${verdictMark}</span>
          <div>
            <p class="xray-verdict-eyebrow">ATS X-Ray &middot; ${passedCount}/${checks.length} checks passed</p>
            <h3 class="xray-verdict-title">${verdictTitle}</h3>
          </div>
        </div>
        <p class="xray-verdict-sub">${verdictSub}</p>
        <ul class="xray-checks">${checksHtml}</ul>
      </div>
    `;

    resultDiv.innerHTML = `
      ${risksHtml}
      <div class="xray-container">
        <div class="xray-pane">
          <h3>Visual PDF</h3>
          <div class="xray-scroll-area pdf-canvas-container" id="pdfContainer"></div>
        </div>
        <div class="xray-pane">
          <h3>Raw Extracted Text Stream</h3>
          <div class="xray-scroll-area xray-text-stream">${textHtml}</div>
        </div>
      </div>
    `;

    // Render the PDF with the browser's native viewer by pointing an <iframe>
    // straight at the endpoint. The auth token rides as a query param because
    // an iframe cannot send an Authorization header.
    const container = document.getElementById('pdfContainer');
    const src = `/api/xray/${id}/pdf?token=${encodeURIComponent(state.token)}`;
    container.innerHTML = `<iframe class="xray-pdf-embed" src="${src}" title="PDF preview"></iframe>`;
  };

  const xrayForm = document.querySelector('#xrayUploadForm');
  xrayForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.querySelector('#xrayFile');
    if (!fileInput.files.length) {
      showToast('Please select a PDF file to scan.', 'error');
      return;
    }
    const formData = new FormData(xrayForm);
    try {
      const data = await runWithLoader('Running ATS X-Ray', [
        'Analyzing layout...',
        'Extracting text stream...',
        'Flagging risks...'
      ], (signal) => api.upload('/api/xray/upload', formData, { signal }));
      
      showToast('X-Ray scan complete');
      await renderReport(data.id, data.report);
      xrayForm.reset();
      
      // refresh dropdown with new scan
      const newRes = await api.request('/api/xray');
      const dropdown = document.querySelector('#xrayHistory');
      if (dropdown) {
        dropdown.innerHTML = `<option value="">-- Select a past scan --</option>` + newRes.versions.map(v => `<option value="${v.id}">${escapeHtml(v.file_name)} (${new Date(v.uploaded_at).toLocaleDateString()})</option>`).join('');
      }
    } catch (err) {
      if (err.message === 'Request cancelled by user.') {
        showToast('Cancelled.', 'info');
      } else {
        showToast(err.message, 'error');
      }
    }
  });

  const historyDropdown = document.querySelector('#xrayHistory');
  if (historyDropdown) {
    historyDropdown.addEventListener('change', (e) => {
      const id = e.target.value;
      if (id) {
        const version = versions.find(v => String(v.id) === id);
        if (version) {
          renderReport(version.id, version.parsability_report);
        }
      } else {
        document.querySelector('#xrayResult').style.display = 'none';
      }
    });
  }
}


/* ----------------------------------------------------------------
   Legal Pages
   ---------------------------------------------------------------- */
async function termsView() {
  const content = `
    <div class="legal-card-shell">
      <div class="legal-header">
        <h2 class="legal-title">Terms & Conditions</h2>
        <div class="legal-meta">Last Updated: July 2026</div>
      </div>
      <div class="legal-section">
        <h3>1. Use of Service</h3>
        <p>Welcome to CV Builder Platform. By using our website and services, you agree to comply with and be bound by the following terms and conditions. You agree to use our services only for lawful purposes and in a manner that does not infringe on the rights of, or restrict the use of this service by, any third party.</p>
      </div>
      <div class="legal-section">
        <h3>2. User Accounts</h3>
        <p>To access certain features, you must create an account. You are responsible for maintaining the confidentiality of your account credentials and password. Your personal details will be kept secure under modern JWT standards.</p>
      </div>
      <div class="legal-section">
        <h3>3. Intellectual Property</h3>
        <p>All content generated by our AI is provided for your personal use. The underlying platform, designs, and code remain the intellectual property of CV Builder.</p>
      </div>
      <div class="legal-section">
        <h3>4. Termination</h3>
        <p>We reserve the right to suspend or terminate your access to the service at any time without notice if you violate these terms.</p>
      </div>
      <div style="margin-top: 40px; border-top: 1px solid var(--line); padding-top: 24px; display: flex; justify-content: center;">
        <button class="btn primary" id="btnBackToApp" style="padding: 10px 28px; font-weight: 600; border-radius: var(--r-control);">
          ${state.token ? 'Back to Settings' : 'Back to Registration'}
        </button>
      </div>
    </div>
  `;
  if (state.token) {
    shell(content);
  } else {
    app.innerHTML = `
      <main class="auth-shell" style="grid-template-columns: 1fr;">
        <section class="auth-main" style="padding: 40px; justify-content: flex-start; overflow-y: auto;">
          ${content}
        </section>
      </main>
    `;
  }
  
  const btn = document.querySelector('#btnBackToApp');
  if (btn) {
    btn.addEventListener('click', () => {
      if (state.token) {
        navigate('settings');
      } else {
        authView('register');
      }
    });
  }
}

async function privacyView() {
  const content = `
    <div class="legal-card-shell">
      <div class="legal-header">
        <h2 class="legal-title">Privacy Policy</h2>
        <div class="legal-meta">Last Updated: July 2026</div>
      </div>
      <div class="legal-section">
        <h3>1. Information We Collect</h3>
        <p>We collect information you provide directly to us, such as your name, email, CV details, and application tracking data when you register or use the platform.</p>
      </div>
      <div class="legal-section">
        <h3>2. How We Use Information</h3>
        <p>Your data is strictly used to provide the CV Builder service, generate AI cover letters, and score your profile against job descriptions. We do not sell your personal data.</p>
      </div>
      <div class="legal-section">
        <h3>3. Data Security</h3>
        <p>We implement industry-standard security measures, including bcrypt hashing for passwords and secure JWT sessions, to protect your data.</p>
      </div>
      <div class="legal-section">
        <h3>4. Third-Party Sharing</h3>
        <p>We may share necessary data points securely with AI providers (like NVIDIA) solely for the purpose of generating your requested content. No details are shared for advertising purposes.</p>
      </div>
      <div style="margin-top: 40px; border-top: 1px solid var(--line); padding-top: 24px; display: flex; justify-content: center;">
        <button class="btn primary" id="btnBackToApp" style="padding: 10px 28px; font-weight: 600; border-radius: var(--r-control);">
          ${state.token ? 'Back to Settings' : 'Back to Registration'}
        </button>
      </div>
    </div>
  `;
  if (state.token) {
    shell(content);
  } else {
    app.innerHTML = `
      <main class="auth-shell" style="grid-template-columns: 1fr;">
        <section class="auth-main" style="padding: 40px; justify-content: flex-start; overflow-y: auto;">
          ${content}
        </section>
      </main>
    `;
  }

  const btn = document.querySelector('#btnBackToApp');
  if (btn) {
    btn.addEventListener('click', () => {
      if (state.token) {
        navigate('settings');
      } else {
        authView('register');
      }
    });
  }
}

/* ----------------------------------------------------------------
   Router
   ---------------------------------------------------------------- */
async function render() {
  const hash = location.hash.replace('#', '') || 'dashboard';
  const [routeName, queryStr] = hash.split('?');
  state.route = routeName;

  const queryParams = {};
  if (queryStr) {
    queryStr.split('&').forEach((pair) => {
      const [k, v] = pair.split('=');
      queryParams[k] = decodeURIComponent(v || '');
    });
  }

  const publicRoutes = ['terms', 'privacy', 'register', 'login', 'forgot-password'];
  if (!state.token && !publicRoutes.includes(state.route)) {
    authView('login');
    return;
  }

  if (state.token && state.user?.mustChangePassword && state.route !== 'update-password') {
    navigate('update-password');
    return;
  }

  try {
    if (!state.token) {
      if (state.route === 'terms') await termsView();
      else if (state.route === 'privacy') await privacyView();
      else if (state.route === 'register') authView('register');
      else if (state.route === 'forgot-password') await forgotPasswordView();
      else authView('login');
      return;
    }

    if (state.route === 'terms') await termsView();
    else if (state.route === 'privacy') await privacyView();
    else if (state.route === 'dashboard') await dashboardView();
    else if (state.route === 'profile') await profileView();
    else if (state.route === 'cv') await cvView();
    else if (state.route === 'applications') await applicationsView();
    else if (state.route === 'new-application') await newApplicationView();
    else if (state.route === 'settings') await settingsView();
    else if (state.route === 'xray') await xrayView();
    else if (state.route === 'forgot-password') await forgotPasswordView();
    else if (state.route === 'update-password') await updatePasswordView();
    else if (state.route.startsWith('application:')) await applicationDetailView(state.route.split(':')[1]);
    else {
      state.route = 'dashboard';
      await dashboardView();
    }
  } catch (err) {
    if (err.message.toLowerCase().includes('token')) {
      clearAuth();
      authView();
    } else {
      shell(`<section class="panel">${emptyState({ icon: 'alert', title: 'Something went wrong', message: err.message })}</section>`);
    }
  }
}

window.addEventListener('hashchange', render);
render();
