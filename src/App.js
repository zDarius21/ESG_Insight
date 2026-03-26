import { useState } from 'react';
import './App.css';

function App() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  const onFilesSelected = (event) => {
    const selected = Array.from(event.target.files || []);
    if (!selected.length) return;

    setFiles((prev) => {
      const merged = [...prev];
      const seen = new Set(prev.map((f) => `${f.name}-${f.size}-${f.lastModified}`));

      selected.forEach((f) => {
        const key = `${f.name}-${f.size}-${f.lastModified}`;
        if (!seen.has(key)) {
          merged.push(f);
          seen.add(key);
        }
      });

      return merged;
    });

    // Permette di riselezionare lo stesso file in un secondo momento.
    event.target.value = '';
    setReport(null);
    setError('');
  };

  const clearFiles = () => {
    setFiles([]);
    setReport(null);
    setError('');
  };

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
          let err = 'Errore durante l\'anonimizzazione del PDF.';
          try {
            const data = await res.json();
            err = data.error || err;
          } catch {
            // ignore parse errors
          }
          throw new Error(err);
        }

        const blob = await res.blob();
        const contentDisposition = res.headers.get('Content-Disposition') || '';
        const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
        const fileName = filenameMatch ? filenameMatch[1] : `${file.name.replace(/\.pdf$/i, '')}_anonymized.pdf`;

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (e) {
      setError(e.message || 'Errore durante il download dei PDF anonimizzati.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="chat-container">
      <header className="chat-header">
        <h1>Hack AI Thon - ESG Compliance Analyzer</h1>
      </header>

      <div className="tab-content analyze-tab">
      <div className="upload-area">
        <label className="upload-label">
          <input
            type="file"
            accept=".pdf"
            multiple
            onChange={onFilesSelected}
          />
          {files.length
            ? `📄 ${files.length} file selezionati`
            : '📂 Carica uno o più file PDF'}
        </label>
        <button onClick={analyze} disabled={!files.length || loading || downloading}>
          {loading ? '⏳ Analisi aggregata in corso...' : '🔍 Analizza tutti i file'}
        </button>
        <button onClick={downloadAnonymizedPdfs} disabled={!files.length || loading || downloading}>
          {downloading ? '⏳ Creo PDF anonimizzati...' : '📥 Scarica PDF anonimizzati'}
        </button>
        <button onClick={clearFiles} disabled={!files.length || loading || downloading}>
          🧹 Svuota
        </button>
      </div>

      {!!files.length && !report && (
        <div className="section-card">
          <h3>📁 File caricati</h3>
          {files.map((f, idx) => (
            <div key={`${f.name}-${idx}`} className="analysis-text">{idx + 1}. {f.name}</div>
          ))}
        </div>
      )}

      {error && <div className="error-box">❌ {error}</div>}

      {report && (
        <div className="report">
          <div className="report-meta">
            <div className="meta-item"><strong>📦 Totale file analizzati</strong><span>{report.totale_file ?? files.length}</span></div>
            <div className="meta-item"><strong>⚖️ Normative rilevate</strong><span>{report.normative_analizzate?.join(', ')}</span></div>
          </div>

          <div className="section-card">
            <h3>✅ Norme rispettate</h3>
            {report.norme_rispettate?.length ? (
              report.norme_rispettate.map((n, i) => (
                <div key={i} className="analysis-text">
                  <strong>{n.norma}</strong>
                  {n.motivo ? `: ${n.motivo}` : ''}
                </div>
              ))
            ) : (
              <div className="analysis-text">Nessuna norma pienamente rispettata rilevata.</div>
            )}
          </div>

          <div className="section-card">
            <h3>❌ Norme non rispettate</h3>
            {report.norme_non_rispettate?.length ? (
              report.norme_non_rispettate.map((n, i) => (
                <div key={i} className="analysis-text">
                  <strong>{n.norma}</strong>
                  {n.motivo ? `: ${n.motivo}` : ''}
                </div>
              ))
            ) : (
              <div className="analysis-text">Nessuna non conformita critica rilevata.</div>
            )}
          </div>

          <div className="section-card">
            <h3>⚠️ Norme borderline</h3>
            {report.norme_borderline?.length ? (
              report.norme_borderline.map((n, i) => (
                <div key={i} className="analysis-text">
                  <strong>{n.norma}</strong>
                  {n.motivo ? `: ${n.motivo}` : ''}
                </div>
              ))
            ) : (
              <div className="analysis-text">Nessun caso borderline rilevato.</div>
            )}
          </div>

          <div className="section-card">
            <h3>🔧 Azioni correttive</h3>
            {report.azioni_correttive?.length ? (
              report.azioni_correttive.map((azione, i) => (
                <div key={i} className="analysis-text">{i + 1}. {azione}</div>
              ))
            ) : (
              <div className="analysis-text">Nessuna azione suggerita.</div>
            )}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

export default App;

