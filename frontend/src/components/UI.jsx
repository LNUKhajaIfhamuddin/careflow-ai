export function UrgencyBadge({ urgency }) {
  return (
    <span className={`badge badge-${urgency}`}>
      <span className={`pulse-dot pulse-${urgency}`} /> {urgency}
    </span>
  );
}

export function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

export function StatCard({ label, value }) {
  return (
    <div className="card stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

export function Loader({ label = 'Loading…' }) {
  return (
    <div className="empty-state">
      <span className="pulse-dot pulse-low" style={{ marginRight: 8 }} />
      {label}
    </div>
  );
}

export function EmptyState({ label }) {
  return <div className="empty-state">{label}</div>;
}
