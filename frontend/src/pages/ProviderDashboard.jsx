import { useEffect, useState } from 'react';
import client from '../api/client';
import AppShell from '../components/AppShell';
import { UrgencyBadge, StatusBadge, StatCard, Loader, EmptyState } from '../components/UI';

const STATUS_FLOW = {
  pending: 'confirmed',
  confirmed: 'completed',
};
const NEXT_LABEL = {
  pending: 'Confirm',
  confirmed: 'Mark completed',
};

export default function ProviderDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await client.get('/api/appointments');
      setAppointments(data);
    } catch {
      setError('Could not load your schedule. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const advanceStatus = async (appt) => {
    const nextStatus = STATUS_FLOW[appt.status];
    if (!nextStatus) return;
    setUpdatingId(appt.id);
    try {
      await client.patch(`/api/appointments/${appt.id}`, { status: nextStatus });
      await load();
    } catch {
      setError('Could not update that appointment.');
    } finally {
      setUpdatingId(null);
    }
  };

  const pending = appointments.filter((a) => a.status === 'pending');
  const confirmed = appointments.filter((a) => a.status === 'confirmed');
  const completed = appointments.filter((a) => a.status === 'completed');

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1>My schedule</h1>
          <p>Review incoming requests and manage your confirmed appointments.</p>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Pending requests" value={pending.length} />
        <StatCard label="Confirmed" value={confirmed.length} />
        <StatCard label="Completed" value={completed.length} />
        <StatCard label="Total" value={appointments.length} />
      </div>

      {error && <div className="error-text" role="alert">{error}</div>}

      <div className="card">
        <h3 className="section-title">Requiring action</h3>
        {loading ? (
          <Loader />
        ) : [...pending, ...confirmed].length === 0 ? (
          <EmptyState label="No pending or confirmed appointments right now." />
        ) : (
          <div className="appt-list">
            {[...pending, ...confirmed].map((a) => (
              <div className="appt-row" key={a.id}>
                <div className="appt-main">
                  <strong>{a.patient_name}</strong>
                  <div className="appt-meta">{a.reason}</div>
                  <div className="appt-meta">
                    {a.scheduled_time ? new Date(a.scheduled_time).toLocaleString() : 'Time to be confirmed'}
                  </div>
                </div>
                <div className="appt-actions">
                  <UrgencyBadge urgency={a.urgency} />
                  <StatusBadge status={a.status} />
                  {STATUS_FLOW[a.status] && (
                    <button
                      className="btn btn-primary"
                      disabled={updatingId === a.id}
                      onClick={() => advanceStatus(a)}
                    >
                      {updatingId === a.id ? 'Updating…' : NEXT_LABEL[a.status]}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
