import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_BY_ROLE = {
  patient: [
    { to: '/patient', label: 'Dashboard' },
    { to: '/patient/symptom-intake', label: 'Symptom Intake' },
  ],
  provider: [
    { to: '/provider', label: 'My Schedule' },
  ],
  admin: [
    { to: '/admin', label: 'Analytics' },
    { to: '/admin/users', label: 'Users & Appointments' },
  ],
};

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const links = NAV_BY_ROLE[user?.role] || [];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      {/* Accessibility: lets keyboard/screen-reader users jump straight to
          the page content without tabbing through every sidebar link on
          every single navigation. Visually hidden until focused. */}
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">🩺 CareFlow AI</div>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            aria-current={location.pathname === link.to ? 'page' : undefined}
          >
            {link.label}
          </NavLink>
        ))}
        <div className="sidebar-footer">
          <div style={{ marginBottom: 10 }}>
            {user?.full_name}
            <br />
            <span style={{ opacity: 0.7, textTransform: 'capitalize' }}>{user?.role}</span>
          </div>
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>
      <div>
        <div className="topbar-mobile">
          <strong>🩺 CareFlow AI</strong>
          <button className="btn btn-secondary" onClick={handleLogout}>Log out</button>
        </div>
        <main className="main-content" id="main-content" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
