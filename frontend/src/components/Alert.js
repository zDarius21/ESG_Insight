import Icon from './Icon';
import { describeError } from '../api';

const ICONS = { error: 'alert', success: 'check', info: 'info', warn: 'warning' };

/** Messaggio di stato; per gli errori accetta direttamente l'oggetto errore restituito dal client API */
export default function Alert({ type = 'error', error, children, onClose }) {
  const message = error ? describeError(error) : children;
  if (!message) return null;

  return (
    <div className={`alert alert-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <Icon name={ICONS[type]} size={18} strokeWidth={2} />
      <span className="alert-text">{message}</span>
      {onClose && (
        <button className="alert-close" onClick={onClose} title="Chiudi" type="button">
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  );
}
