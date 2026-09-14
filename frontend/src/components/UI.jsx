import { CalendarIcon, CheckCircleIcon, ClockIcon } from './Icons';

export function UrgencyBadge({ urgency = 'low' }) {
  const norm = urgency?.toLowerCase() || 'low';
  return (
    <span className={`badge badge-${norm}`}>
      <span className={`pulse-dot pulse-${norm}`} />
      <span>{norm} urgency</span>
    </span>
  );
}

export function StatusBadge({ status = 'pending' }) {
  const norm = status?.toLowerCase() || 'pending';
  return (
    <span className={`badge badge-${norm}`}>
      {norm === 'confirmed' && <CheckCircleIcon size={12} />}
      {norm === 'pending' && <ClockIcon size={12} />}
      {norm}
    </span>
  );
}

export function StatCard({ label, value, subtext }) {
  return (
    <div className="card stat-card card-hover">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {subtext && <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 4 }}>{subtext}</div>}
    </div>
  );
}

export function Loader({ label = 'Loading…' }) {
  return (
    <div className="empty-state">
      <div
        style={{
          width: 32,
          height: 32,
          border: '3px solid #ccfbf1',
          borderTop: '3px solid #0d9488',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}

export function EmptyState({ label, action }) {
  return (
    <div className="empty-state">
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'var(--primary-subtle)',
          color: 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CalendarIcon size={24} />
      </div>
      <div style={{ maxWidth: 320, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        {label}
      </div>
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

export function Avatar({ name = '', size = 36 }) {
  const initials = (name || 'User')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #0d9488 0%, #0284c7 100%)',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: size * 0.4,
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(13, 148, 136, 0.25)',
      }}
    >
      {initials}
    </div>
  );
}
