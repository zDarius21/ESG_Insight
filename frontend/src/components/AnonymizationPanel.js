/**
 * Pannello di trasparenza: mostra, per ogni file selezionato, quali dati sensibili il motore AI
 * maschera prima dell'analisi. `entries` contiene { key, fileName, preview, error } per ogni file.
 */
export default function AnonymizationPanel({ entries }) {
  const previews = entries.map((entry) => entry.preview).filter(Boolean);
  const loading = entries.some((entry) => !entry.preview && !entry.error);

  const totals = previews.reduce((acc, item) => {
    Object.entries(item.placeholder_counts || {}).forEach(([key, value]) => {
      acc[key] = (acc[key] || 0) + Number(value || 0);
    });
    return acc;
  }, {});
  const totalMasked = Object.values(totals).reduce((sum, count) => sum + count, 0);

  return (
    <section className="transparency-panel">
      <div className="transparency-title-row">
        <h3 className="transparency-title">Gestione Dati Anonimizzazione</h3>
        <span className="transparency-state">{loading ? 'Preparazione…' : 'Anteprima live'}</span>
      </div>
      <p className="transparency-subtle">
        Prima dell'analisi il testo viene anonimizzato in memoria: il modello AI elabora solo la versione
        mascherata. Il PDF originale resta archiviato in modo riservato tra i tuoi documenti.
      </p>

      {!previews.length && loading ? (
        <div className="transparency-loading">Preparazione anteprima in corso...</div>
      ) : (
        <>
          <div className="transparency-inline-info">
            <span><strong>{entries.length}</strong> documenti</span>
            <span><strong>{totalMasked}</strong> entità anonimizzate</span>
            <span><strong>{Object.keys(totals).length}</strong> categorie privacy</span>
          </div>

          <div className="transparency-doc-picker-label">Seleziona l'anteprima del documento</div>
          <div className="transparency-doc-list">
            {entries.map(({ key, fileName, preview, error }, idx) => (
              <details className="transparency-doc" key={key} open={idx === 0}>
                <summary className="transparency-doc-head">
                  <div className="transparency-doc-main">
                    <strong>{fileName}</strong>
                    <small>
                      {preview
                        ? `${preview.original_characters} → ${preview.anonymized_characters} caratteri`
                        : error ? 'Anteprima non disponibile' : 'In preparazione…'}
                    </small>
                  </div>
                  <span className="transparency-doc-cta">Apri</span>
                </summary>
                {error && <p className="preview-error">{error}</p>}
                {preview && (
                  <>
                    <div className="preview-placeholders">
                      {Object.entries(preview.placeholder_counts || {}).length ? (
                        Object.entries(preview.placeholder_counts).map(([label, value]) => (
                          <span key={label} className="preview-pill">{label}: {value}</span>
                        ))
                      ) : (
                        <span className="preview-pill">Nessun dato sensibile rilevato</span>
                      )}
                    </div>
                    <pre className="preview-text">{preview.preview_text || 'Anteprima non disponibile'}</pre>
                  </>
                )}
              </details>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
