import { useEffect, useRef, useState } from 'react';
import { api, ANALYSIS_COST, MAX_FILE_MB, describeError } from '../api';
import { useAuth } from '../auth';
import { navigate } from '../navigation';
import { baseName, formatSize } from '../format';
import Alert from '../components/Alert';
import Icon from '../components/Icon';
import AnalysisDashboard from '../components/AnalysisDashboard';
import AnonymizationPanel from '../components/AnonymizationPanel';

const STATUS_LABELS = {
  ready: 'Pronto',
  uploading: 'Caricamento…',
  analyzing: 'Analisi AI…',
  done: 'Analizzato',
  error: 'Errore',
};

const fileKey = (file) => `${file.name}-${file.size}-${file.lastModified}`;
const isPdf = (file) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

/**
 * Nuova analisi: ogni PDF caricato diventa un documento del backend (salvato su MinIO)
 * e viene analizzato dal motore AI, con addebito di ANALYSIS_COST token per documento.
 */
export default function AnalyzePage() {
  const { user, updateTokens } = useAuth();
  const [items, setItems] = useState([]);
  const [previews, setPreviews] = useState({});
  const [description, setDescription] = useState('');
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const inputRef = useRef(null);
  const requestedPreviews = useRef(new Set());

  const patchItem = (key, changes) =>
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...changes } : item)));

  const addFiles = (newFiles) => {
    const rejected = [];
    const accepted = newFiles.filter((file) => {
      if (!isPdf(file)) {
        rejected.push(`${file.name} (solo PDF)`);
        return false;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        rejected.push(`${file.name} (oltre ${MAX_FILE_MB} MB)`);
        return false;
      }
      return true;
    });

    setItems((prev) => {
      const merged = [...prev];
      const seen = new Set(prev.map((item) => item.key));
      accepted.forEach((file) => {
        const key = fileKey(file);
        if (seen.has(key)) return;
        seen.add(key);
        merged.push({ key, file, title: baseName(file.name), status: 'ready', error: null, document: null });
      });
      return merged;
    });
    setNotice(rejected.length ? `File esclusi: ${rejected.join(', ')}` : '');
    setError(null);
  };

  const onFilesSelected = (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length) addFiles(selected);
    e.target.value = '';
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (running) return;
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) addFiles(dropped);
  };

  const removeItem = (key) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
    setSelectedKey((current) => (current === key ? null : current));
  };

  const reset = () => {
    setItems([]);
    setPreviews({});
    requestedPreviews.current = new Set();
    setSelectedKey(null);
    setDescription('');
    setError(null);
    setNotice('');
  };

  // Anteprima di anonimizzazione: richiesta una sola volta per ogni file aggiunto
  useEffect(() => {
    items.forEach(({ key, file }) => {
      if (requestedPreviews.current.has(key)) return;
      requestedPreviews.current.add(key);
      api.documents
        .previewAnonymization(file)
        .then((preview) => setPreviews((prev) => ({ ...prev, [key]: { preview } })))
        .catch((err) => setPreviews((prev) => ({ ...prev, [key]: { error: describeError(err) } })));
    });
  }, [items]);

  // L'analisi prosegue sul server anche chiudendo la pagina, ma l'esito non verrebbe mostrato
  useEffect(() => {
    if (!running) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [running]);

  const toProcess = items.filter((item) => item.status !== 'done');
  const doneItems = items.filter((item) => item.status === 'done');
  const selected = doneItems.find((item) => item.key === selectedKey) || doneItems[0];
  const requiredTokens = toProcess.length * ANALYSIS_COST;
  const canAnalyze = user.tokens >= ANALYSIS_COST;

  const analyzeAll = async () => {
    setRunning(true);
    setError(null);
    for (const item of toProcess) {
      let doc = item.document;
      try {
        if (!doc) {
          patchItem(item.key, { status: 'uploading', error: null });
          doc = await api.documents.create({
            file: item.file,
            title: item.title.trim() || baseName(item.file.name),
            description: description.trim() || `Documento caricato da ESG Insight (${item.file.name})`,
          });
          patchItem(item.key, { document: doc });
        }
        patchItem(item.key, { status: 'analyzing', error: null });
        const outcome = await api.documents.analyze(doc.id);
        updateTokens(outcome.tokensRemaining);
        patchItem(item.key, { status: 'done', document: outcome.document });
        setSelectedKey((current) => current ?? item.key);
      } catch (err) {
        const hint = doc ? ' Il documento è salvato: puoi rilanciare l\'analisi anche dalla sezione Documenti.' : '';
        patchItem(item.key, { status: 'error', error: describeError(err) + hint });
        if (err.status === 402) {
          setError(new Error('Token insufficienti per proseguire con le analisi.'));
          break;
        }
      }
    }
    setRunning(false);
  };

  const downloadReport = async (documentId) => {
    setDownloading(true);
    setError(null);
    try {
      await api.documents.downloadReport(documentId);
    } catch (err) {
      setError(err);
    } finally {
      setDownloading(false);
    }
  };

  const hasErrors = toProcess.some((item) => item.status === 'error');
  let analyzeLabel = `Analizza ${toProcess.length > 1 ? `${toProcess.length} documenti` : 'documento'}`;
  if (hasErrors) analyzeLabel = 'Riprova analisi';

  return (
    <>
      {!doneItems.length && (
        <div className="hero">
          <span className="hero-tag">Analisi ESG &amp; Normativa</span>
          <h1 className="hero-title">
            Verifica la Conformità<br />ESG dei Tuoi Documenti
          </h1>
          <p className="hero-desc">
            Carica i tuoi report aziendali in PDF e ottieni un'analisi dettagliata della conformità alle
            principali normative ESG, con suggerimenti correttivi personalizzati.
          </p>
        </div>
      )}

      {/* ── Upload Zone ── */}
      <div
        className={`upload-zone${dragging ? ' dragging' : ''}${items.length ? ' has-files' : ''}`}
        onDragOver={(e) => { e.preventDefault(); if (!running) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !items.length && inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".pdf,application/pdf" multiple onChange={onFilesSelected} style={{ display: 'none' }} />

        {!items.length ? (
          <div className="upload-empty">
            <div className="upload-icon"><Icon name="upload" size={38} strokeWidth={1.5} /></div>
            <div className="upload-text">
              <strong>Trascina qui i tuoi PDF</strong>
              <span>oppure{' '}
                <button
                  type="button"
                  className="link-btn"
                  onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                >sfoglia i file</button>
              </span>
            </div>
            <div className="upload-hint">
              Solo file .pdf (max {MAX_FILE_MB} MB) · Multipli file supportati · {ANALYSIS_COST} token per documento
            </div>
          </div>
        ) : (
          <div className="file-list-area" onClick={(e) => e.stopPropagation()}>
            <div className="file-list-header">
              <span className="file-count">{items.length} file caricati</span>
              <button type="button" className="link-btn small" onClick={() => inputRef.current?.click()} disabled={running}>
                + Aggiungi
              </button>
            </div>
            <div className="file-list">
              {items.map((item) => (
                <div key={item.key}>
                  <div className={`file-item file-${item.status}`}>
                    <div className="file-icon"><Icon name="file" /></div>
                    <div className="file-info">
                      <input
                        className="file-title-input"
                        value={item.title}
                        onChange={(e) => patchItem(item.key, { title: e.target.value })}
                        disabled={running || Boolean(item.document)}
                        aria-label={`Titolo del documento ${item.file.name}`}
                        title="Titolo del documento"
                      />
                      <span className="file-size">{item.file.name} · {formatSize(item.file.size)}</span>
                    </div>
                    <span className={`file-status status-${item.status}`}>
                      {(item.status === 'uploading' || item.status === 'analyzing') && <span className="spinner spinner-dark" />}
                      {item.status === 'done' && <Icon name="check" size={13} strokeWidth={3} />}
                      {STATUS_LABELS[item.status]}
                    </span>
                    <button type="button" className="file-remove" onClick={() => removeItem(item.key)} disabled={running} title="Rimuovi">×</button>
                  </div>
                  {item.error && <p className="file-error">{item.error}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {notice && <Alert type="warn" onClose={() => setNotice('')}>{notice}</Alert>}

      {toProcess.length > 0 && (
        <div className="analysis-options">
          <label className="field">
            <span>Descrizione (opzionale)</span>
            <textarea
              className="input textarea"
              rows={2}
              placeholder="Es. Bilancio di sostenibilità 2024 del gruppo"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={running}
            />
          </label>
          <div className={`token-info${user.tokens < requiredTokens ? ' warn' : ''}`}>
            <Icon name="coin" size={20} />
            <div>
              <div>
                <strong>{requiredTokens} token</strong> necessari ({ANALYSIS_COST} per documento) ·
                disponibili <strong>{user.tokens}</strong>
              </div>
              {user.tokens < requiredTokens && (
                <small>
                  {canAnalyze
                    ? 'Saldo insufficiente per tutti i documenti: verranno analizzati finché i token lo consentono.'
                    : 'Saldo insufficiente: i token si ricaricano automaticamente di 10 ogni 6 ore.'}
                </small>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Action Bar ── */}
      {items.length > 0 && (
        <div className="action-bar">
          {toProcess.length > 0 && (
            <button type="button" className="btn btn-primary" onClick={analyzeAll} disabled={running || !canAnalyze}>
              {running ? (
                <><span className="spinner" />Analisi in corso...</>
              ) : (
                <><Icon name="search" />{analyzeLabel}</>
              )}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={reset} disabled={running}>
            <Icon name="trash" />
            Svuota
          </button>
        </div>
      )}

      {running && (
        <Alert type="info">
          L'analisi AI può richiedere qualche minuto per documento (al primo avvio il motore scarica i modelli).
          Puoi consultare le altre sezioni nel frattempo.
        </Alert>
      )}

      <Alert error={error} onClose={() => setError(null)} />

      {/* ── Report ── */}
      {selected && (
        <section className="results-section">
          <div className="section-header">
            <h2 className="section-title">Risultati dell'analisi</h2>
            {doneItems.length > 1 && (
              <div className="result-tabs" role="tablist">
                {doneItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="tab"
                    aria-selected={item.key === selected.key}
                    className={`result-tab${item.key === selected.key ? ' active' : ''}`}
                    onClick={() => setSelectedKey(item.key)}
                  >
                    {item.document.title}
                  </button>
                ))}
              </div>
            )}
          </div>
          <AnalysisDashboard
            result={selected.document.analysisResult || {}}
            actions={(
              <>
                <button type="button" className="btn btn-accent" onClick={() => downloadReport(selected.document.id)} disabled={downloading}>
                  {downloading ? <><span className="spinner" />Download...</> : <><Icon name="download" />Scarica Report PDF</>}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => navigate(`documenti/${selected.document.id}`)}>
                  <Icon name="folder" />
                  Apri nei documenti
                </button>
                <button type="button" className="btn btn-outline" onClick={reset} disabled={running}>
                  <Icon name="refresh" />
                  Nuova analisi
                </button>
              </>
            )}
          />
        </section>
      )}

      {items.length > 0 && (
        <AnonymizationPanel
          entries={items.map((item) => ({ key: item.key, fileName: item.file.name, ...previews[item.key] }))}
        />
      )}
    </>
  );
}
