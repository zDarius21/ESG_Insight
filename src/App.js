import { useState, useRef } from 'react';
import './App.css';

function ComplianceScore({ score }) {
  const clamped = Math.min(100, Math.max(0, score));
  const color = clamped >= 70 ? '#059669' : clamped >= 40 ? '#d97706' : '#dc2626';
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (clamped / 100) * circ;
  return (
    <div className="score-widget">
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle
          cx="65" cy="65" r={r} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 65 65)"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div className="score-text" style={{ color }}>
        <span className="score-num">{Math.round(clamped)}</span>
        <span className="score-pct">%</span>
        <div className="score-label">Score</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    ok:   { label: 'Conforme',     cls: 'badge-ok'   },
    fail: { label: 'Non Conforme', cls: 'badge-fail' },
    warn: { label: 'Borderline',   cls: 'badge-warn' },
  };
  const { label, cls } = map[status] || map.ok;
  return <span className={`status-badge ${cls}`}>{label}</span>;
}

function NormCard({ norm, status }) {
  return (
    <div className={`norm-card norm-${status}`}>
      <div className="norm-header">
        <strong className="norm-name">{norm.norma}</strong>
        <StatusBadge status={status} />
      </div>
      {norm.motivo && <p className="norm-reason">{norm.motivo}</p>}
    </div>
  );
}

function App() {
  const [files, setFiles]         = useState([]);
  const [dragging, setDragging]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [report, setReport]       = useState(null);
  const [error, setError]         = useState('');
  const inputRef = useRef(null);

  const addFiles = (newFiles) => {
    setFiles((prev) => {
      const merged = [...prev];
      const seen = new Set(prev.map((f) => `${f.name}-${f.size}-${f.lastModified}`));
      newFiles.forEach((f) => {
        const key = `${f.name}-${f.size}-${f.lastModified}`;
        if (!seen.has(key)) { merged.push(f); seen.add(key); }
      });
      return merged;
    });
    setReport(null);
    setError('');
  };

  const onFilesSelected = (e) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;
    addFiles(selected);
    e.target.value = '';
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) => f.type === 'application/pdf');
    if (dropped.length) addFiles(dropped);
  };

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setReport(null);
    setError('');
  };

  const clearFiles = () => { setFiles([]); setReport(null); setError(''); };

  const analyze = async () => {
    if (!files.length) return;
    setLoading(true);
    setReport(null);
    setError('');
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      const res = await fetch('/api/analyze/', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setReport(data);
    } catch {
      setError('Errore di connessione al server.');
    } finally { setLoading(false); }
  };

  const downloadAnonymizedPdfs = async () => {
    if (!files.length) return;
    setDownloading(true);
    setError('');
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/anonymize-pdf/', { method: 'POST', body: formData });
        if (!res.ok) {
          let err = "Errore durante l'anonimizzazione del PDF.";
          try { const d = await res.json(); err = d.error || err; } catch { /* ignore */ }
          throw new Error(err);
        }
        const blob = await res.blob();
        const cd = res.headers.get('Content-Disposition') || '';
        const match = cd.match(/filename="?([^";]+)"?/i);
        const fileName = match ? match[1] : `${file.name.replace(/\.pdf$/i, '')}_anonymized.pdf`;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName;
        document.body.appendChild(a); a.click(); a.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (e) {
      setError(e.message || 'Errore durante il download dei PDF anonimizzati.');
    } finally { setDownloading(false); }
  };

  const totalNorms = (report?.norme_rispettate?.length || 0)
    + (report?.norme_non_rispettate?.length || 0)
    + (report?.norme_borderline?.length || 0);
  const complianceScore = totalNorms > 0
    ? ((report?.norme_rispettate?.length || 0) / totalNorms) * 100
    : null;

  return (
    <div className="app">
      {/* ── Top Navigation ── */}
      <nav className="topnav">
        <div className="topnav-inner">
          <div className="brand">
            <div className="brand-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div>
              <div className="brand-name">ESG Insight</div>
              <div className="brand-sub">Compliance Intelligence Platform</div>
            </div>
          </div>
          <div className="nav-right">
            <span className="ai-badge">✦ Powered by AI</span>
          </div>
        </div>
      </nav>

      <main className="main">
        {/* ── Hero ── */}
        {!report && (
          <div className="hero">
            <span className="hero-tag">Analisi ESG &amp; Normativa</span>
            <h1 className="hero-title">
              Verifica la Conformità<br />ESG dei Tuoi Documenti
            </h1>
            <p className="hero-desc">
              Carica i tuoi report aziendali in PDF e ottieni in pochi secondi un'analisi
              dettagliata della conformità alle principali normative ESG, con
              suggerimenti correttivi personalizzati.
            </p>
          </div>
        )}

        {/* ── Upload Zone ── */}
        <div
          className={`upload-zone${dragging ? ' dragging' : ''}${files.length ? ' has-files' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !files.length && inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" accept=".pdf" multiple onChange={onFilesSelected} style={{ display: 'none' }} />

          {!files.length ? (
            <div className="upload-empty">
              <div className="upload-icon">
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                </svg>
              </div>
              <div className="upload-text">
                <strong>Trascina qui i tuoi PDF</strong>
                <span>oppure{' '}
                  <button
                    className="link-btn"
                    onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                  >sfoglia i file</button>
                </span>
              </div>
              <div className="upload-hint">Solo file .pdf · Multipli file supportati</div>
            </div>
          ) : (
            <div className="file-list-area" onClick={(e) => e.stopPropagation()}>
              <div className="file-list-header">
                <span className="file-count">{files.length} file caricati</span>
                <button className="link-btn small" onClick={() => inputRef.current?.click()}>+ Aggiungi</button>
              </div>
              <div className="file-list">
                {files.map((f, i) => (
                  <div className="file-item" key={`${f.name}-${i}`}>
                    <div className="file-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                    </div>
                    <div className="file-info">
                      <span className="file-name">{f.name}</span>
                      <span className="file-size">{(f.size / 1024).toFixed(1)} KB</span>
                    </div>
                    <button className="file-remove" onClick={() => removeFile(i)} title="Rimuovi">×</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Action Bar ── */}
        {!!files.length && (
          <div className="action-bar">
            <button className="btn btn-primary" onClick={analyze} disabled={loading || downloading}>
              {loading ? (
                <><span className="spinner" />Analisi in corso...</>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  Analizza Documenti
                </>
              )}
            </button>
            <button className="btn btn-secondary" onClick={downloadAnonymizedPdfs} disabled={loading || downloading}>
              {downloading ? (
                <><span className="spinner spinner-dark" />Creazione PDF...</>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                  </svg>
                  Scarica PDF Anonimizzati
                </>
              )}
            </button>
            <button className="btn btn-ghost" onClick={clearFiles} disabled={loading || downloading}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
              </svg>
              Svuota
            </button>
          </div>
        )}

        {error && (
          <div className="alert alert-error">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        {/* ── Report ── */}
        {report && (
          <div className="report-container">
            {/* Dashboard row */}
            <div className="dashboard-row">
              {complianceScore !== null && <ComplianceScore score={complianceScore} />}

              {/* Actions panel — right of score */}
              {report.azioni_correttive?.length > 0 && (
                <div className="actions-panel">
                  <div className="actions-panel-header">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M14.7 6.3a1 1 0 010 1.4l-8 8a1 1 0 01-.4.25l-3 1a1 1 0 01-1.3-1.3l1-3a1 1 0 01.25-.4l8-8a1 1 0 011.4 0z"/>
                      <path d="M15 7l2 2"/>
                    </svg>
                    <span>Azioni Correttive</span>
                    <span className="actions-panel-count">{report.azioni_correttive.length}</span>
                  </div>
                  <ol className="actions-panel-list">
                    {report.azioni_correttive.map((a, i) => (
                      <li key={i} className="actions-panel-item">
                        <span className="actions-panel-num">{i + 1}</span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="dashboard-stats">
                <div className="stat-card stat-ok">
                  <div className="stat-num">{report.norme_rispettate?.length ?? 0}</div>
                  <div className="stat-label">Conformi</div>
                </div>
                <div className="stat-card stat-fail">
                  <div className="stat-num">{report.norme_non_rispettate?.length ?? 0}</div>
                  <div className="stat-label">Non Conformi</div>
                </div>
                <div className="stat-card stat-warn">
                  <div className="stat-num">{report.norme_borderline?.length ?? 0}</div>
                  <div className="stat-label">Borderline</div>
                </div>
                <div className="stat-card stat-info">
                  <div className="stat-num">{report.azioni_correttive?.length ?? 0}</div>
                  <div className="stat-label">Azioni</div>
                </div>
              </div>
              <div className="dashboard-meta">
                <div className="meta-row">
                  <span>File analizzati</span>
                  <strong>{report.totale_file ?? files.length}</strong>
                </div>
                <div className="meta-row">
                  <span>Normative verificate</span>
                  <strong>{report.normative_analizzate?.length ?? '—'}</strong>
                </div>
                {report.normative_analizzate?.length ? (
                  <div className="norm-tags">
                    {report.normative_analizzate.map((n, i) => (
                      <span key={i} className="norm-tag">{n}</span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Three-column norms grid */}
            <div className="norms-grid">
              <div className="norms-col">
                <div className="col-header col-ok">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Conformi</span>
                  <span className="col-count">{report.norme_rispettate?.length ?? 0}</span>
                </div>
                {report.norme_rispettate?.length
                  ? report.norme_rispettate.map((n, i) => <NormCard key={i} norm={n} status="ok" />)
                  : <p className="empty-col">Nessuna norma rispettata</p>}
              </div>
              <div className="norms-col">
                <div className="col-header col-fail">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  <span>Non Conformi</span>
                  <span className="col-count">{report.norme_non_rispettate?.length ?? 0}</span>
                </div>
                {report.norme_non_rispettate?.length
                  ? report.norme_non_rispettate.map((n, i) => <NormCard key={i} norm={n} status="fail" />)
                  : <p className="empty-col">Nessuna non conformità</p>}
              </div>
              <div className="norms-col">
                <div className="col-header col-warn">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <span>Borderline</span>
                  <span className="col-count">{report.norme_borderline?.length ?? 0}</span>
                </div>
                {report.norme_borderline?.length
                  ? report.norme_borderline.map((n, i) => <NormCard key={i} norm={n} status="warn" />)
                  : <p className="empty-col">Nessun caso borderline</p>}
              </div>
            </div>

            <div className="report-footer">
              <button className="btn btn-outline" onClick={clearFiles}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polyline points="1 4 1 10 7 10"/>
                  <path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
                </svg>
                Nuova Analisi
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <span>© 2025 ESG Insight · Compliance Intelligence Platform</span>
        <span>Dati elaborati in modo sicuro · GDPR Compliant</span>
      </footer>
    </div>
  );
}

export default App;
