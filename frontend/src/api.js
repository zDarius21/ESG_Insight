// Client HTTP verso il backend Express. Il frontend chiama sempre /api/...: in sviluppo il prefisso
// viene inoltrato al backend da src/setupProxy.js, in Docker da nginx (vedi nginx.conf).
// Il motore AI non è mai chiamato direttamente dal browser.
const API_BASE = (process.env.REACT_APP_API_URL || '/api').replace(/\/$/, '');
const TOKEN_KEY = 'esg-insight-token';

// Regole di business del backend, mostrate nell'interfaccia
export const ANALYSIS_COST = 10;
export const MAX_TOKENS = 100;
export const MAX_FILE_MB = 10;

export class ApiError extends Error {
  constructor(message, status = 0, details = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

let unauthorizedHandler = () => {};

export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler;
};

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const setToken = (token) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};

/** Messaggio leggibile di un errore, con il dettaglio dei campi non validi restituito da Zod */
export const describeError = (err) => {
  if (!err) return '';
  const details = (err.details || []).map((d) => d.message).filter(Boolean);
  return details.length ? `${err.message}: ${details.join(' · ')}` : err.message || 'Errore imprevisto';
};

async function request(path, { method = 'GET', json, form, raw = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body;
  if (form) {
    body = form;
  } else if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers, body });
  } catch {
    throw new ApiError('Impossibile contattare il server. Verifica che il backend sia avviato.');
  }

  if (res.ok && raw) return res;

  const payload = await res.json().catch(() => null);
  if (!res.ok || payload?.success === false) {
    // Token scaduto o non valido: si chiude la sessione (il login fallito non ha token e non passa di qui)
    if (res.status === 401 && token) unauthorizedHandler();
    if (!payload && res.status >= 502) {
      throw new ApiError('Il server non è raggiungibile al momento. Riprova tra poco.', res.status);
    }
    const details = Array.isArray(payload?.details) ? payload.details : [];
    throw new ApiError(payload?.error || `Errore del server (${res.status})`, res.status, details);
  }
  return payload?.data;
}

const toForm = (fields) => {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') form.append(key, value);
  });
  return form;
};

/** Scarica un file protetto da JWT (non basta un link: serve l'header Authorization) */
async function download(path, fallbackName) {
  const res = await request(path, { raw: true });
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = match ? match[1] : fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const api = {
  auth: {
    login: (email, password) => request('/auth/login', { method: 'POST', json: { email, password } }),
    register: (email, password) => request('/auth/register', { method: 'POST', json: { email, password } }),
    me: () => request('/auth/me'),
    updateMe: (changes) => request('/auth/me', { method: 'PATCH', json: changes }),
  },
  documents: {
    list: () => request('/documents'),
    create: ({ file, title, description }) =>
      request('/documents', { method: 'POST', form: toForm({ title, description, file }) }),
    update: (id, changes) => request(`/documents/${id}`, { method: 'PATCH', json: changes }),
    remove: (id) => request(`/documents/${id}`, { method: 'DELETE' }),
    analyze: (id) => request(`/documents/${id}/analyze`, { method: 'POST' }),
    previewAnonymization: (file) =>
      request('/documents/anonymize-preview', { method: 'POST', form: toForm({ file }) }),
    downloadFile: (id) => download(`/documents/${id}/file`, `documento_${id}.pdf`),
    downloadReport: (id) => download(`/documents/${id}/report`, `report_documento_${id}.pdf`),
  },
  regulations: {
    list: () => request('/regulations'),
    create: ({ name, version, description, file }) =>
      request('/regulations', { method: 'POST', form: toForm({ name, version, description, file }) }),
    update: (id, changes) => request(`/regulations/${id}`, { method: 'PATCH', json: changes }),
    remove: (id) => request(`/regulations/${id}`, { method: 'DELETE' }),
  },
  users: {
    list: () => request('/users'),
    create: (email, password) => request('/users', { method: 'POST', json: { email, password } }),
    update: (id, changes) => request(`/users/${id}`, { method: 'PATCH', json: changes }),
    remove: (id) => request(`/users/${id}`, { method: 'DELETE' }),
    rechargeTokens: (id, tokens) => request(`/users/${id}/tokens`, { method: 'POST', json: { tokens } }),
  },
};
