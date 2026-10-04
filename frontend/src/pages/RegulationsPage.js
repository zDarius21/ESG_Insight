import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import Alert from '../components/Alert';
import Icon from '../components/Icon';

const EMPTY_FORM = { name: '', version: '', description: '', file: null };

/** Form di creazione (con PDF opzionale da cui estrarre la descrizione) e di modifica di una normativa */
function RegulationForm({ initial, onSubmit, onCancel, allowFile }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: form.name.trim(),
        version: form.version.trim(),
        description: form.description.trim(),
        file: form.file,
      });
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  return (
    <form className="inline-form" onSubmit={submit}>
      <div className="form-grid">
        <label className="field">
          <span>Nome</span>
          <input className="input" value={form.name} onChange={set('name')} required placeholder="Es. ISO 14001" />
        </label>
        <label className="field">
          <span>Versione</span>
          <input className="input" value={form.version} onChange={set('version')} required placeholder="Es. 2015" />
        </label>
      </div>
      <label className="field">
        <span>Descrizione</span>
        <textarea className="input textarea" rows={4} value={form.description} onChange={set('description')}
          required={!allowFile || !form.file} disabled={Boolean(form.file)}
          placeholder={form.file ? 'Verrà estratta dal PDF allegato' : 'Requisiti principali della normativa'} />
      </label>
      {allowFile && (
        <label className="field">
          <span>Oppure allega il testo in PDF (opzionale)</span>
          <input className="input" type="file" accept=".pdf,application/pdf"
            onChange={(e) => setForm((prev) => ({ ...prev, file: e.target.files?.[0] || null }))} />
          <small className="field-hint">Se allegato, la descrizione viene estratta automaticamente dal PDF.</small>
        </label>
      )}
      <Alert error={error} />
      <div className="row-actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving && <span className="spinner" />}Salva
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>Annulla</button>
      </div>
    </form>
  );
}

function RegulationCard({ regulation, isAdmin, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const long = regulation.description.length > 280;

  return (
    <article className="card reg-card">
      <div className="reg-head">
        <h3 className="reg-name">{regulation.name}</h3>
        <span className="version-badge">v. {regulation.version}</span>
      </div>
      <p className={`reg-desc${expanded ? ' expanded' : ''}`}>{regulation.description}</p>
      <div className="reg-foot">
        {long && (
          <button type="button" className="link-btn small" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Mostra meno' : 'Mostra tutto'}
          </button>
        )}
        {isAdmin && (
          <div className="row-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(regulation)} title="Modifica">
              <Icon name="edit" size={14} />
            </button>
            <button type="button" className="btn btn-ghost btn-sm btn-danger-ghost" onClick={() => onDelete(regulation)} title="Elimina">
              <Icon name="trash" size={14} />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

export default function RegulationsPage() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [regulations, setRegulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.regulations.list();
      setRegulations([...list].sort((a, b) => a.name.localeCompare(b.name)));
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

  const create = async (data) => {
    await api.regulations.create(data);
    setCreating(false);
    await load();
  };

  const update = async ({ name, version, description }) => {
    const updated = await api.regulations.update(editing.id, { name, version, description });
    setRegulations((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setEditing(null);
  };

  const remove = async (regulation) => {
    if (!window.confirm(`Eliminare la normativa "${regulation.name}"?`)) return;
    setError(null);
    try {
      await api.regulations.remove(regulation.id);
      setRegulations((prev) => prev.filter((r) => r.id !== regulation.id));
    } catch (err) {
      setError(err);
    }
  };

  const q = query.trim().toLowerCase();
  const visible = q
    ? regulations.filter((r) => `${r.name} ${r.version} ${r.description}`.toLowerCase().includes(q))
    : regulations;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Normative</h1>
          <p className="page-subtitle">Catalogo delle normative e degli standard ESG di riferimento.</p>
        </div>
        <div className="row-actions">
          <input className="input search-input" type="search" placeholder="Cerca normativa…"
            value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Cerca normativa" />
          {isAdmin && !creating && (
            <button type="button" className="btn btn-primary" onClick={() => { setCreating(true); setEditing(null); }}>
              <Icon name="plus" />Nuova normativa
            </button>
          )}
        </div>
      </div>

      <Alert error={error} onClose={() => setError(null)} />

      {creating && (
        <div className="card">
          <h2 className="card-title">Nuova normativa</h2>
          <RegulationForm initial={EMPTY_FORM} onSubmit={create} onCancel={() => setCreating(false)} allowFile />
        </div>
      )}

      {editing && (
        <div className="card">
          <h2 className="card-title">Modifica «{editing.name}»</h2>
          <RegulationForm
            key={editing.id}
            initial={{ ...EMPTY_FORM, name: editing.name, version: editing.version, description: editing.description }}
            onSubmit={update}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {loading && !regulations.length ? (
        <div className="card loading-card"><span className="spinner spinner-dark" /> Caricamento normative...</div>
      ) : !visible.length ? (
        <div className="empty-state card">{q ? 'Nessuna normativa corrisponde alla ricerca.' : 'Nessuna normativa presente.'}</div>
      ) : (
        <div className="reg-grid">
          {visible.map((regulation) => (
            <RegulationCard
              key={regulation.id}
              regulation={regulation}
              isAdmin={isAdmin}
              onEdit={(r) => { setEditing(r); setCreating(false); }}
              onDelete={remove}
            />
          ))}
        </div>
      )}
    </>
  );
}
