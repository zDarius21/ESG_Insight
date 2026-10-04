import { useState } from 'react';
import { useAuth } from '../auth';
import Alert from '../components/Alert';
import Icon from '../components/Icon';

const FEATURES = [
  { icon: 'search', text: 'Analisi di conformità a CSRD, EU Taxonomy, GRI, ISO e DNF con modelli AI' },
  { icon: 'shield', text: 'Anonimizzazione dei dati sensibili prima di ogni elaborazione' },
  { icon: 'download', text: 'Report PDF con score, non conformità e azioni correttive' },
];

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isRegister = mode === 'register';

  const switchMode = (next) => {
    setMode(next);
    setError(null);
    setConfirm('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (isRegister && password !== confirm) {
      setError(new Error('Le password non coincidono.'));
      return;
    }
    setSubmitting(true);
    try {
      // In caso di successo la pagina viene sostituita dall'applicazione
      await (isRegister ? register(email.trim(), password) : login(email.trim(), password));
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-layout">
        <section className="auth-hero">
          <div className="brand">
            <div className="brand-icon"><Icon name="layers" size={20} /></div>
            <div>
              <div className="brand-name">ESG Insight</div>
              <div className="brand-sub">Compliance Intelligence Platform</div>
            </div>
          </div>
          <span className="hero-tag">Analisi ESG &amp; Normativa</span>
          <h1 className="hero-title">Verifica la Conformità ESG dei Tuoi Documenti</h1>
          <p className="hero-desc">
            Carica i tuoi report aziendali in PDF e ottieni un'analisi dettagliata della conformità alle
            principali normative ESG, con suggerimenti correttivi personalizzati.
          </p>
          <ul className="auth-features">
            {FEATURES.map((f) => (
              <li key={f.icon}>
                <span className="auth-feature-icon"><Icon name={f.icon} /></span>
                {f.text}
              </li>
            ))}
          </ul>
        </section>

        <section className="auth-card card">
          <div className="auth-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={!isRegister}
              className={`auth-tab${!isRegister ? ' active' : ''}`} onClick={() => switchMode('login')}>
              Accedi
            </button>
            <button type="button" role="tab" aria-selected={isRegister}
              className={`auth-tab${isRegister ? ' active' : ''}`} onClick={() => switchMode('register')}>
              Registrati
            </button>
          </div>

          <h2 className="auth-title">{isRegister ? 'Crea il tuo account' : 'Accedi a ESG Insight'}</h2>
          <p className="muted small">
            {isRegister
              ? 'Ogni nuovo account riceve 100 token: ogni analisi ne consuma 10.'
              : 'Inserisci le credenziali del tuo account.'}
          </p>

          <form className="form" onSubmit={submit}>
            <label className="field">
              <span>Email</span>
              <input className="input" type="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="field">
              <span>Password</span>
              <input className="input" type="password" required
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                value={password} onChange={(e) => setPassword(e.target.value)} />
              {isRegister && (
                <small className="field-hint">
                  Almeno 8 caratteri, con maiuscola, minuscola, numero e carattere speciale, senza spazi.
                </small>
              )}
            </label>
            {isRegister && (
              <label className="field">
                <span>Conferma password</span>
                <input className="input" type="password" autoComplete="new-password" required
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </label>
            )}

            <Alert error={error} />

            <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
              {submitting && <span className="spinner" />}
              {isRegister ? 'Crea account' : 'Accedi'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
