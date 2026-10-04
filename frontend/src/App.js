import './App.css';
import { ANALYSIS_COST } from './api';
import { AuthProvider, useAuth } from './auth';
import { useHashRoute } from './navigation';
import Icon from './components/Icon';
import LoginPage from './pages/LoginPage';
import AnalyzePage from './pages/AnalyzePage';
import DocumentsPage from './pages/DocumentsPage';
import RegulationsPage from './pages/RegulationsPage';
import UsersPage from './pages/UsersPage';
import ProfilePage from './pages/ProfilePage';

const NAV_ITEMS = [
  { page: 'analisi', label: 'Nuova analisi', icon: 'search' },
  { page: 'documenti', label: 'Documenti', icon: 'folder' },
  { page: 'normative', label: 'Normative', icon: 'book' },
  { page: 'utenti', label: 'Utenti', icon: 'users', adminOnly: true },
];

function Shell() {
  const { user, checking, logout } = useAuth();
  const { page, param } = useHashRoute();

  if (checking) {
    return (
      <div className="app-loading">
        <span className="spinner spinner-dark" /> Caricamento...
      </div>
    );
  }
  if (!user) return <LoginPage />;

  const isAdmin = user.role === 'admin';
  const navItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
  const current = page === 'profilo' || navItems.some((item) => item.page === page) ? page : 'analisi';

  let content = null;
  if (current === 'documenti') content = <DocumentsPage documentId={param} />;
  else if (current === 'normative') content = <RegulationsPage />;
  else if (current === 'utenti') content = <UsersPage />;
  else if (current === 'profilo') content = <ProfilePage />;

  return (
    <div className="app">
      <nav className="topnav">
        <div className="topnav-inner">
          <a className="brand" href="#/analisi">
            <div className="brand-icon"><Icon name="layers" size={20} /></div>
            <div>
              <div className="brand-name">ESG Insight</div>
              <div className="brand-sub">Compliance Intelligence Platform</div>
            </div>
          </a>

          <div className="nav-links">
            {navItems.map((item) => (
              <a
                key={item.page}
                href={`#/${item.page}`}
                className={`nav-link${current === item.page ? ' active' : ''}`}
                aria-current={current === item.page ? 'page' : undefined}
              >
                <Icon name={item.icon} size={15} />
                {item.label}
              </a>
            ))}
          </div>

          <div className="nav-right">
            <span
              className={`token-pill${user.tokens < ANALYSIS_COST ? ' low' : ''}`}
              title={`Token disponibili: ogni analisi ne costa ${ANALYSIS_COST}`}
            >
              <Icon name="coin" size={15} />
              {user.tokens}
            </span>
            <a href="#/profilo" className={`user-chip${current === 'profilo' ? ' active' : ''}`} title="Profilo">
              <Icon name="user" size={15} />
              <span className="user-email">{user.email}</span>
              {isAdmin && <span className="role-badge role-admin">admin</span>}
            </a>
            <button type="button" className="icon-btn" onClick={logout} title="Esci">
              <Icon name="logout" size={17} />
            </button>
          </div>
        </div>
      </nav>

      <main className="main">
        {/* Sempre montata: un'analisi in corso prosegue anche consultando le altre sezioni */}
        <div className="page" hidden={current !== 'analisi'}>
          <AnalyzePage />
        </div>
        {content && <div className="page">{content}</div>}
      </main>

      <footer className="footer">
        <span>© 2026 ESG Insight · Compliance Intelligence Platform</span>
        <span>Dati elaborati in modo sicuro · GDPR Compliant</span>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
