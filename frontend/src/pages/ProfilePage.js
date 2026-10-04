import { useEffect, useState } from 'react';
import { api, ANALYSIS_COST, MAX_TOKENS } from '../api';
import { useAuth } from '../auth';
import { formatDate } from '../format';
import Alert from '../components/Alert';
import Icon from '../components/Icon';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');

  // Saldo token aggiornato (la ricarica automatica avviene lato server)
  useEffect(() => {
    refreshUser().catch(() => {});
  }, [refreshUser]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setNotice('');
    const changes = {};
    if (email.trim() && email.trim() !== user.email) changes.email = email.trim();
    if (password) {
      if (password !== confirm) {
        setError(new Error('Le password non coincidono.'));
        return;
      }
      changes.password = password;
    }
    if (!Object.keys(changes).length) {
      setError(new Error('Inserisci una nuova email o una nuova password.'));
      return;
    }

    setSaving(true);
    try {
      await api.auth.updateMe(changes);
      await refreshUser();
      setEmail('');
      setPassword('');
      setConfirm('');
      setNotice('Profilo aggiornato.');
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  const pct = Math.min(100, Math.round((user.tokens / MAX_TOKENS) * 100));

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Profilo</h1>
          <p className="page-subtitle">Dati dell'account e saldo dei token di analisi.</p>
        </div>
      </div>

      <div className="profile-grid">
        <div className="card">
          <h2 className="card-title">Account</h2>
          <dl className="info-list">
            <div><dt>Email</dt><dd>{user.email}</dd></div>
            <div>
              <dt>Ruolo</dt>
              <dd><span className={`role-badge ${user.role === 'admin' ? 'role-admin' : 'role-user'}`}>{user.role}</span></dd>
            </div>
            <div><dt>Registrato il</dt><dd>{formatDate(user.createdAt)}</dd></div>
          </dl>

          <h2 className="card-title">Token di analisi</h2>
          <div className="token-summary">
            <Icon name="coin" size={22} />
            <strong>{user.tokens}</strong>
            <span className="muted">/ {MAX_TOKENS}</span>
          </div>
          <div className="token-bar token-bar-lg"><div className="token-bar-fill" style={{ width: `${pct}%` }} /></div>
          <p className="muted small">
            Ogni analisi costa {ANALYSIS_COST} token. Il saldo si ricarica automaticamente di 10 token ogni 6 ore
            fino a un massimo di {MAX_TOKENS}; un amministratore può effettuare ricariche manuali.
          </p>
        </div>

        <div className="card">
          <h2 className="card-title">Modifica credenziali</h2>
          <form className="form" onSubmit={submit}>
            <label className="field">
              <span>Nuova email</span>
              <input className="input" type="email" placeholder={user.email} value={email}
                onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </label>
            <label className="field">
              <span>Nuova password</span>
              <input className="input" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              <small className="field-hint">
                Almeno 8 caratteri, con maiuscola, minuscola, numero e carattere speciale, senza spazi.
              </small>
            </label>
            <label className="field">
              <span>Conferma nuova password</span>
              <input className="input" type="password" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" disabled={!password} />
            </label>
            <Alert error={error} />
            {notice && <Alert type="success">{notice}</Alert>}
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving && <span className="spinner" />}Salva modifiche
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
