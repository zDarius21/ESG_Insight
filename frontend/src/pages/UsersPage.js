import { useCallback, useEffect, useState } from 'react';
import { api, MAX_TOKENS } from '../api';
import { useAuth } from '../auth';
import { formatDate } from '../format';
import Alert from '../components/Alert';
import Icon from '../components/Icon';

function TokenBar({ tokens }) {
  const pct = Math.min(100, Math.round((tokens / MAX_TOKENS) * 100));
  return (
    <div className="token-cell">
      <span className="token-value">{tokens}</span>
      <div className="token-bar"><div className="token-bar-fill" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function CreateUserForm({ onCreate, onCancel }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onCreate(email.trim(), password);
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  return (
    <form className="inline-form" onSubmit={submit}>
      <div className="form-grid">
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" />
        </label>
        <label className="field">
          <span>Password</span>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
        </label>
      </div>
      <small className="field-hint">
        Il nuovo utente avrà ruolo «user». Password: almeno 8 caratteri con maiuscola, minuscola, numero e carattere speciale.
      </small>
      <Alert error={error} />
      <div className="row-actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving && <span className="spinner" />}Crea utente
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>Annulla</button>
      </div>
    </form>
  );
}

function RechargeControl({ user, onRecharge, disabled }) {
  const room = MAX_TOKENS - user.tokens;
  const [amount, setAmount] = useState(Math.min(10, room) || 1);

  if (room <= 0) return <span className="muted small">Saldo massimo</span>;

  const value = Number(amount);
  const valid = Number.isInteger(value) && value >= 1 && value <= room;

  return (
    <div className="recharge-control">
      <input
        className="input input-sm"
        type="number"
        min={1}
        max={room}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        aria-label={`Token da ricaricare a ${user.email}`}
      />
      <button type="button" className="btn btn-ghost btn-sm" disabled={disabled || !valid}
        onClick={() => onRecharge(user, value)} title={`Massimo ${room} token`}>
        <Icon name="coin" size={14} />Ricarica
      </button>
    </div>
  );
}

export default function UsersPage() {
  const { user: me, refreshUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.users.list();
      setUsers([...list].sort((a, b) => a.id - b.id));
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

  const run = async (target, action, successMessage) => {
    setBusyId(target.id);
    setError(null);
    setNotice('');
    try {
      await action();
      setNotice(successMessage);
    } catch (err) {
      setError(err);
    } finally {
      setBusyId(null);
    }
  };

  const create = async (email, password) => {
    await api.users.create(email, password);
    setCreating(false);
    setNotice(`Utente ${email} creato.`);
    await load();
  };

  const promote = async (target) => {
    if (!window.confirm(`Promuovere ${target.email} ad amministratore? L'operazione non è reversibile.`)) return;
    await run(target, async () => {
      const updated = await api.users.update(target.id, { role: 'admin' });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
    }, `${target.email} è ora amministratore.`);
  };

  const recharge = (target, amount) =>
    run(target, async () => {
      const updated = await api.users.rechargeTokens(target.id, amount);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, tokens: updated.tokens } : u)));
      if (target.id === me.id) await refreshUser();
    }, `Ricaricati ${amount} token a ${target.email}.`);

  const remove = async (target) => {
    if (!window.confirm(`Eliminare ${target.email}? Verranno eliminati anche tutti i suoi documenti e report.`)) return;
    await run(target, async () => {
      await api.users.remove(target.id);
      setUsers((prev) => prev.filter((u) => u.id !== target.id));
    }, `Utente ${target.email} eliminato.`);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Utenti</h1>
          <p className="page-subtitle">Gestione degli account, dei ruoli e dei token di analisi.</p>
        </div>
        <div className="row-actions">
          <button type="button" className="btn btn-ghost" onClick={load} disabled={loading}>
            <Icon name="refresh" />Aggiorna
          </button>
          {!creating && (
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              <Icon name="plus" />Nuovo utente
            </button>
          )}
        </div>
      </div>

      <Alert error={error} onClose={() => setError(null)} />
      {notice && <Alert type="success" onClose={() => setNotice('')}>{notice}</Alert>}

      {creating && (
        <div className="card">
          <h2 className="card-title">Nuovo utente</h2>
          <CreateUserForm onCreate={create} onCancel={() => setCreating(false)} />
        </div>
      )}

      {loading && !users.length ? (
        <div className="card loading-card"><span className="spinner spinner-dark" /> Caricamento utenti...</div>
      ) : (
        <div className="card table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Utente</th>
                <th>Ruolo</th>
                <th>Token</th>
                <th>Registrato</th>
                <th className="col-actions">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isMe = u.id === me.id;
                const busy = busyId === u.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.email}</strong>
                      {isMe && <span className="you-badge">tu</span>}
                    </td>
                    <td>
                      <span className={`role-badge ${u.role === 'admin' ? 'role-admin' : 'role-user'}`}>{u.role}</span>
                    </td>
                    <td><TokenBar tokens={u.tokens} /></td>
                    <td className="nowrap">{formatDate(u.createdAt)}</td>
                    <td className="col-actions">
                      <div className="row-actions">
                        {/* La key azzera l'importo proposto quando cambia il saldo */}
                        <RechargeControl key={`${u.id}-${u.tokens}`} user={u} onRecharge={recharge} disabled={busy} />
                        {u.role === 'user' && (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => promote(u)} disabled={busy} title="Promuovi ad amministratore">
                            <Icon name="shield" size={14} />Admin
                          </button>
                        )}
                        <button type="button" className="btn btn-ghost btn-sm btn-danger-ghost" onClick={() => remove(u)}
                          disabled={busy || isMe} title={isMe ? 'Non puoi eliminare il tuo account' : 'Elimina utente'}>
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
