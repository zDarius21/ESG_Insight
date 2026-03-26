import { useState, useRef, useEffect } from 'react';
import './App.css';

// ── Tab: Chatbot ───────────────────────────────────────────────────────────────
function ChatTab() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Ciao! Sono il tuo assistente ESG. Come posso aiutarti?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMessage = { role: 'user', content: text };
    const updated = [...messages, userMessage];
    setMessages(updated);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/chat/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated }),
      });
      const data = await res.json();
      setMessages([...updated, { role: 'assistant', content: data.reply || 'Errore: ' + data.error }]);
    } catch {
      setMessages([...updated, { role: 'assistant', content: 'Errore di connessione.' }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="tab-content">
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <span className="bubble">{msg.content}</span>
          </div>
        ))}
        {loading && <div className="message assistant"><span className="bubble typing">...</span></div>}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input-area">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Scrivi un messaggio... (Invio per inviare)"
          rows={2}
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()}>Invia</button>
      </div>
    </div>
  );
}

// ── Tab: Analisi Documento ─────────────────────────────────────────────────────
function AnalyzeTab() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    setReport(null);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/analyze/', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setReport(data);
    } catch {
      setError('Errore di connessione al server.');
    } finally { setLoading(false); }
  };

  return (
    <div className="tab-content analyze-tab">
      <div className="upload-area">
        <label className="upload-label">
          <input type="file" accept=".pdf,.txt" onChange={e => setFile(e.target.files[0])} />
          {file ? `📄 ${file.name}` : '📂 Carica documento PDF o TXT'}
        </label>
        <button onClick={analyze} disabled={!file || loading}>
          {loading ? '⏳ Analisi in corso...' : '🔍 Analizza Conformità'}
        </button>
      </div>

      {error && <div className="error-box">❌ {error}</div>}

      {report && (
        <div className="report">
          <div className="report-meta">
            <div className="meta-item"><strong>📄 Tipo documento</strong><span>{report.tipo_documento?.join(', ')}</span></div>
            <div className="meta-item"><strong>⚖️ Normative rilevate</strong><span>{report.normative_analizzate?.join(', ')}</span></div>
            <div className="meta-item"><strong>📊 KPI trovati</strong><span>{report.kpi_rilevati?.join(', ') || 'Nessuno'}</span></div>
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
  );
}

// ── App principale ─────────────────────────────────────────────────────────────
function App() {
  const [tab, setTab] = useState('chat');

  return (
    <div className="chat-container">
      <header className="chat-header">
        <h1>Hack AI Thon — ESG Compliance Analyzer</h1>
        <div className="tabs">
          <button className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>💬 Chat</button>
          <button className={tab === 'analyze' ? 'active' : ''} onClick={() => setTab('analyze')}>📋 Analisi Documento</button>
        </div>
      </header>

      {tab === 'chat' ? <ChatTab /> : <AnalyzeTab />}
    </div>
  );
}

export default App;

