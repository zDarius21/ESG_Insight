import Icon from './Icon';
import { formatDateTime } from '../format';

function ComplianceScore({ score }) {
  const clamped = Math.min(100, Math.max(0, score));
  const color = clamped >= 70 ? '#059669' : clamped >= 40 ? '#d97706' : '#dc2626';
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (clamped / 100) * circ;
  return (
    <div className="score-widget">
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="10" />
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

function NormColumn({ title, items, status, icon, emptyText }) {
  return (
    <div className="norms-col">
      <div className={`col-header col-${status}`}>
        <Icon name={icon} strokeWidth={2.5} />
        <span>{title}</span>
        <span className="col-count">{items.length}</span>
      </div>
      {items.length
        ? items.map((n, i) => <NormCard key={i} norm={n} status={status} />)
        : <p className="empty-col">{emptyText}</p>}
    </div>
  );
}

/** Percentuale di norme conformi sul totale delle norme valutate */
export const complianceScore = (result) => {
  const ok = result?.norme_rispettate?.length || 0;
  const total = ok + (result?.norme_non_rispettate?.length || 0) + (result?.norme_borderline?.length || 0);
  return total > 0 ? (ok / total) * 100 : null;
};

/**
 * Dashboard dei risultati di un'analisi di conformità ESG.
 * `result` è il campo analysisResult del documento, salvato dal backend con il formato del motore AI.
 */
export default function AnalysisDashboard({ result, actions }) {
  const score = complianceScore(result);
  const rispettate = result.norme_rispettate || [];
  const nonRispettate = result.norme_non_rispettate || [];
  const borderline = result.norme_borderline || [];
  const azioni = result.azioni_correttive || [];
  const normative = result.normative_analizzate || [];

  return (
    <div className="report-container">
      <div className="dashboard-row">
        <div className="dashboard-badges">
          {score !== null && (
            <div className="badge-card badge-score">
              <ComplianceScore score={score} />
            </div>
          )}

          {azioni.length > 0 && (
            <div className="badge-card badge-actions">
              <div className="badge-actions-header">
                <Icon name="wrench" size={14} strokeWidth={2.5} />
                <span>Azioni Correttive</span>
                <span className="badge-actions-count">{azioni.length}</span>
              </div>
              <ol className="badge-actions-list">
                {azioni.map((a, i) => (
                  <li key={i} className="badge-actions-item">
                    <span className="badge-actions-num">{i + 1}</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <div className="dashboard-right">
          <div className="dashboard-stats">
            <div className="stat-card stat-ok">
              <div className="stat-num">{rispettate.length}</div>
              <div className="stat-label">Conformi</div>
            </div>
            <div className="stat-card stat-fail">
              <div className="stat-num">{nonRispettate.length}</div>
              <div className="stat-label">Non Conformi</div>
            </div>
            <div className="stat-card stat-warn">
              <div className="stat-num">{borderline.length}</div>
              <div className="stat-label">Borderline</div>
            </div>
            <div className="stat-card stat-info">
              <div className="stat-num">{azioni.length}</div>
              <div className="stat-label">Azioni</div>
            </div>
          </div>
          <div className="dashboard-meta">
            <div className="meta-row">
              <span>Data analisi</span>
              <strong>{formatDateTime(result.data_analisi)}</strong>
            </div>
            <div className="meta-row">
              <span>Tipologia documento</span>
              <strong>{result.tipo_documento?.join(', ') || '—'}</strong>
            </div>
            <div className="meta-row">
              <span>Normative verificate</span>
              <strong>{normative.length || '—'}</strong>
            </div>
            {normative.length > 0 && (
              <div className="norm-tags">
                {normative.map((n, i) => (
                  <span key={i} className="norm-tag">{n}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="norms-grid">
        <NormColumn title="Conformi" items={rispettate} status="ok" icon="check" emptyText="Nessuna norma rispettata" />
        <NormColumn title="Non Conformi" items={nonRispettate} status="fail" icon="close" emptyText="Nessuna non conformità" />
        <NormColumn title="Borderline" items={borderline} status="warn" icon="warning" emptyText="Nessun caso borderline" />
      </div>

      {actions && <div className="report-footer">{actions}</div>}
    </div>
  );
}
