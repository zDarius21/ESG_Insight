import { useCallback, useEffect, useState } from 'react';
import { api, ANALYSIS_COST } from '../api';
import { useAuth } from '../auth';
import { navigate } from '../navigation';
import { formatDate, formatDateTime } from '../format';
import Alert from '../components/Alert';
import Icon from '../components/Icon';
import AnalysisDashboard from '../components/AnalysisDashboard';

const byNewest = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);

function DocStatus({ status }) {
  return status === 'analyzed'
    ? <span className="status-badge badge-ok">Analizzato</span>
    : <span className="status-badge badge-warn">In attesa</span>;
}

/** Pulsanti di azione su un documento, condivisi tra elenco e dettaglio */
function DocumentActions({ doc, busy, onAnalyze, onDownload, onEdit, onDelete, compact }) {
  const cls = `btn btn-ghost${compact ? ' btn-sm' : ''}`;
  return (
    <div className="row-actions">
      {doc.status === 'pending' && doc.filePath && (
        <button type="button" className={`btn btn-primary${compact ? ' btn-sm' : ''}`} onClick={() => onAnalyze(doc)} disabled={Boolean(busy)}
          title={`Costo: ${ANALYSIS_COST} token`}>
          {busy === 'analyze' ? <span className="spinner" /> : <Icon name="search" size={14} />}
          {busy === 'analyze' ? 'Analisi…' : 'Analizza'}
        </button>
      )}
      {doc.filePath && (
        <button type="button" className={cls} onClick={() => onDownload(doc, 'file')} disabled={Boolean(busy)} title="Scarica il PDF originale">
          <Icon name="file" size={14} />PDF
        </button>
      )}
      {doc.reportPath && (
        <button type="button" className={cls} onClick={() => onDownload(doc, 'report')} disabled={Boolean(busy)} title="Scarica il report dell'analisi">
          <Icon name="download" size={14} />Report
        </button>
      )}
      {onEdit && (
        <button type="button" className={cls} onClick={() => onEdit(doc)} disabled={Boolean(busy)} title="Modifica titolo e descrizione">
          <Icon name="edit" size={14} />
        </button>
      )}
      <button type="button" className={`${cls} btn-danger-ghost`} onClick={() => onDelete(doc)} disabled={Boolean(busy)} title="Elimina">
        <Icon name="trash" size={14} />
      </button>
    </div>
  );
}

function EditDocumentForm({ doc, onSave, onCancel }) {
  const [title, setTitle] = useState(doc.title);
  const [description, setDescription] = useState(doc.description);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(doc, { title: title.trim(), description: description.trim() });
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  return (
    <form className="inline-form" onSubmit={submit}>
      <label className="field">
        <span>Titolo</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label className="field">
        <span>Descrizione</span>
        <textarea className="input textarea" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} required />
      </label>
      <Alert error={error} />
      <div className="row-actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>Salva</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>Annulla</button>
      </div>
    </form>
  );
}

export default function DocumentsPage({ documentId }) {
  const { updateTokens } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState({});
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.documents.list();
      setDocuments([...list].sort(byNewest));
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setDocBusy = (id, action) => setBusy((prev) => ({ ...prev, [id]: action }));
  const replaceDoc = (updated) => setDocuments((prev) => prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));

  const analyze = async (doc) => {
    setDocBusy(doc.id, 'analyze');
    setError(null);
    try {
      const outcome = await api.documents.analyze(doc.id);
      replaceDoc(outcome.document);
      updateTokens(outcome.tokensRemaining);
      navigate(`documenti/${doc.id}`);
    } catch (err) {
      setError(err);
    } finally {
      setDocBusy(doc.id, null);
    }
  };

  const download = async (doc, kind) => {
    setDocBusy(doc.id, kind);
    setError(null);
    try {
      await (kind === 'report' ? api.documents.downloadReport(doc.id) : api.documents.downloadFile(doc.id));
    } catch (err) {
      setError(err);
    } finally {
      setDocBusy(doc.id, null);
    }
  };

  const save = async (doc, changes) => {
    const updated = await api.documents.update(doc.id, changes);
    replaceDoc(updated);
    setEditingId(null);
  };

  const remove = async (doc) => {
    if (!window.confirm(`Eliminare definitivamente "${doc.title}" insieme al file e al report?`)) return;
    setDocBusy(doc.id, 'delete');
    setError(null);
    try {
      await api.documents.remove(doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      if (documentId) navigate('documenti');
    } catch (err) {
      setError(err);
      setDocBusy(doc.id, null);
    }
  };

  const actionProps = { onAnalyze: analyze, onDownload: download, onDelete: remove };

  // ── Dettaglio di un documento ──
  if (documentId) {
    const doc = documents.find((d) => String(d.id) === String(documentId));
    return (
      <>
        <button type="button" className="back-link" onClick={() => navigate('documenti')}>
          <Icon name="arrowLeft" size={14} /> Tutti i documenti
        </button>
        <Alert error={error} onClose={() => setError(null)} />
        {loading && !doc && <div className="card loading-card"><span className="spinner spinner-dark" /> Caricamento...</div>}
        {!loading && !doc && <div className="empty-state card">Documento non trovato.</div>}
        {doc && (
          <>
            <div className="card doc-detail">
              {editingId === doc.id ? (
                <EditDocumentForm doc={doc} onSave={save} onCancel={() => setEditingId(null)} />
              ) : (
                <div className="doc-detail-head">
                  <div className="doc-detail-text">
                    <div className="doc-detail-title">
                      <h1 className="page-title">{doc.title}</h1>
                      <DocStatus status={doc.status} />
                    </div>
                    <p className="page-subtitle">{doc.description}</p>
                    <p className="muted small">
                      Caricato il {formatDateTime(doc.createdAt)}
                      {doc.status === 'analyzed' && ` · Ultimo aggiornamento ${formatDateTime(doc.updatedAt)}`}
                    </p>
                  </div>
                  <DocumentActions doc={doc} busy={busy[doc.id]} {...actionProps} onEdit={() => setEditingId(doc.id)} />
                </div>
              )}
            </div>

            {doc.analysisResult && <AnalysisDashboard result={doc.analysisResult} />}
            {!doc.analysisResult && doc.status === 'analyzed' && (
              <Alert type="info">I risultati dettagliati non sono disponibili per questo documento.</Alert>
            )}
            {doc.status === 'pending' && (
              <Alert type="info">
                {doc.filePath
                  ? `Il documento non è ancora stato analizzato. L'analisi costa ${ANALYSIS_COST} token.`
                  : 'Il documento non ha un file PDF associato e non può essere analizzato.'}
              </Alert>
            )}
          </>
        )}
      </>
    );
  }

  // ── Elenco documenti ──
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">I miei documenti</h1>
          <p className="page-subtitle">Documenti caricati, stato delle analisi e report generati.</p>
        </div>
        <div className="row-actions">
          <button type="button" className="btn btn-ghost" onClick={load} disabled={loading}>
            <Icon name="refresh" />Aggiorna
          </button>
          <button type="button" className="btn btn-primary" onClick={() => navigate('analisi')}>
            <Icon name="plus" />Nuova analisi
          </button>
        </div>
      </div>

      <Alert error={error} onClose={() => setError(null)} />

      {loading && !documents.length ? (
        <div className="card loading-card"><span className="spinner spinner-dark" /> Caricamento documenti...</div>
      ) : !documents.length ? (
        <div className="empty-state card">
          <Icon name="folder" size={28} />
          <p>Non hai ancora caricato documenti.</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('analisi')}>Carica il primo documento</button>
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Documento</th>
                <th>Stato</th>
                <th>Caricato</th>
                <th className="col-actions">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  {editingId === doc.id ? (
                    <td colSpan={4}>
                      <EditDocumentForm doc={doc} onSave={save} onCancel={() => setEditingId(null)} />
                    </td>
                  ) : (
                    <>
                      <td>
                        <button type="button" className="doc-link" onClick={() => navigate(`documenti/${doc.id}`)}>
                          {doc.title}
                        </button>
                        <div className="cell-sub">{doc.description}</div>
                      </td>
                      <td><DocStatus status={doc.status} /></td>
                      <td className="nowrap">{formatDate(doc.createdAt)}</td>
                      <td className="col-actions">
                        <DocumentActions doc={doc} busy={busy[doc.id]} {...actionProps} onEdit={() => setEditingId(doc.id)} compact />
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
