export const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export const formatSize = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`;

/** Nome del file senza estensione .pdf, usato come titolo predefinito del documento */
export const baseName = (fileName) => fileName.replace(/\.pdf$/i, '');
