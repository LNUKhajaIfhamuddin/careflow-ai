import { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import {
  StethoscopeIcon,
  CalendarIcon,
  SparklesIcon,
  ActivityIcon,
  UsersIcon,
  LogOutIcon,
  ChevronRightIcon,
  BellIcon,
  CheckCircleIcon,
} from './Icons';
import { Avatar } from './UI';

const NAV_CONFIG = {
  patient: [
    { to: '/patient', label: 'My Care Overview', icon: CalendarIcon },
    { to: '/patient/symptom-intake', label: 'AI Symptom Check-in', icon: SparklesIcon },
  ],
  provider: [
    { to: '/provider', label: 'Clinical Schedule', icon: CalendarIcon },
  ],
  admin: [
    { to: '/admin', label: 'Operations Analytics', icon: ActivityIcon },
    { to: '/admin/users', label: 'Users & Appointments', icon: UsersIcon },
  ],
};

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const links = NAV_CONFIG[user?.role] || [];

  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    const fetchNotifications = async () => {
      try {
        const res = await client.get('/api/appointments/notifications/me');
        setNotifications(res.data || []);
      } catch {
        // Background notifications failure should not break dashboard
      }
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // refresh every 15 seconds
    return () => clearInterval(interval);
  }, [user]);

  // Click outside to close notification popover
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const markAsRead = async (notifId) => {
    try {
      await client.patch(`/api/appointments/notifications/${notifId}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
      );
    } catch {
      // ignore
    }
  };

  const markAllAsRead = async () => {
    try {
      await client.post('/api/appointments/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // ignore
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <div className="brand-icon-wrap">
            <StethoscopeIcon size={20} />
          </div>
          <div>
            <div>CareFlow AI</div>
            <div style={{ fontSize: '0.7rem', color: '#5eead4', fontWeight: 500, letterSpacing: '0.02em' }}>
              Clinical Coordination
            </div>
          </div>
        </div>

        <div className="nav-section-title">Navigation</div>

        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              aria-current={location.pathname === link.to ? 'page' : undefined}
            >
              <Icon size={18} />
              <span style={{ flex: 1 }}>{link.label}</span>
              <ChevronRightIcon size={14} style={{ opacity: 0.5 }} />
            </NavLink>
          );
        })}

        <div className="sidebar-footer">
          <div className="user-profile-badge">
            <Avatar name={user?.full_name} size={36} />
            <div className="user-details">
              <div className="user-name" title={user?.full_name}>
                {user?.full_name || 'Care Member'}
              </div>
              <div className="user-role">
                {user?.role} {user?.specialty ? `· ${user.specialty}` : ''}
              </div>
            </div>
          </div>

          <button
            className="btn btn-secondary"
            style={{
              width: '100%',
              background: 'rgba(255, 255, 255, 0.06)',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              color: '#f1f5f9',
            }}
            onClick={handleLogout}
          >
            <LogOutIcon size={16} />
            Log out
          </button>
        </div>
      </aside>

      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        {/* Desktop Topbar for Notification Center */}
        <header
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: '16px 48px 0 48px',
            position: 'relative',
          }}
          className="desktop-header"
        >
          <div style={{ position: 'relative' }} ref={notifRef}>
            <button
              type="button"
              className="btn btn-secondary"
              aria-label="View notifications"
              style={{
                position: 'relative',
                padding: '8px 12px',
                borderRadius: 8,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
              onClick={() => setShowNotifications((prev) => !prev)}
            >
              <BellIcon size={18} />
              {unreadCount > 0 && (
                <span
                  style={{
                    background: 'var(--rose, #e11d48)',
                    color: '#ffffff',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 999,
                    lineHeight: 1,
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '110%',
                  width: 340,
                  maxHeight: 420,
                  background: '#ffffff',
                  borderRadius: 12,
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)',
                  border: '1px solid #e2e8f0',
                  zIndex: 9999,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#f8fafc',
                  }}
                >
                  <strong style={{ fontSize: '0.88rem' }}>Notifications ({notifications.length})</strong>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div style={{ overflowY: 'auto', maxHeight: 340 }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                      No notifications yet.
                    </div>
                  ) : (
                    notifications.map((n) => {
                      const timeStr = new Date(n.created_at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      return (
                        <div
                          key={n.id}
                          onClick={() => !n.is_read && markAsRead(n.id)}
                          style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid #f1f5f9',
                            cursor: n.is_read ? 'default' : 'pointer',
                            background: n.is_read ? '#ffffff' : '#f0fdfa',
                            display: 'flex',
                            gap: 10,
                            alignItems: 'flex-start',
                          }}
                        >
                          <div style={{ marginTop: 2, flexShrink: 0, color: n.is_read ? '#94a3b8' : 'var(--primary)' }}>
                            <CheckCircleIcon size={16} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--ink)', lineHeight: 1.4 }}>
                              {n.message}
                            </p>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {timeStr}
                            </span>
                          </div>
                          {!n.is_read && (
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: 'var(--primary)',
                                marginTop: 6,
                                flexShrink: 0,
                              }}
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Mobile Topbar */}
        <header className="topbar-mobile">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="brand-icon-wrap" style={{ width: 30, height: 30 }}>
              <StethoscopeIcon size={16} />
            </div>
            <strong>CareFlow AI</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn btn-secondary"
              style={{ padding: '6px 10px', fontSize: '0.8rem', position: 'relative' }}
              onClick={() => setShowNotifications((prev) => !prev)}
            >
              <BellIcon size={16} />
              {unreadCount > 0 && (
                <span
                  style={{
                    background: 'var(--rose, #e11d48)',
                    color: '#ffffff',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '1px 4px',
                    borderRadius: 999,
                    marginLeft: 4,
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={handleLogout}>
              Log out
            </button>
          </div>
        </header>

        <main className="main-content" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
