import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import AppShell from '../components/AppShell';
import { UrgencyBadge, StatusBadge, Loader, EmptyState } from '../components/UI';

export default function PatientDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await client.get('/api/appointments');
      setAppointments(data);
    } catch (err) {
      setError('Could not load your appointments. Please refresh to try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCancel = async (id) => {
    setCancellingId(id);
    try {
      await client.delete(`/api/appointments/${id}`);
      await load();
    } catch {
      setError('Could not cancel that appointment. Please try again.');
    } finally {
      setCancellingId(null);
    }
  };

  const upcoming = appointments.filter((a) => a.status !== 'cancelled' && a.status !== 'completed');
  const history = appointments.filter((a) => a.status === 'cancelled' || a.status === 'completed');

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1>Your care overview</h1>
          <p>Track upcoming appointments and start a new symptom check-in anytime.</p>
        </div>
        <Link to="/patient/symptom-intake" className="btn btn-primary">+ New symptom check-in</Link>
      </div>

      {error && <div className="error-text" role="alert">{error}</div>}

      <div className="card">
        <h3 className="section-title">Upcoming appointments</h3>
        {loading ? (
          <Loader label="Loading your appointments…" />
        ) : upcoming.length === 0 ? (
          <EmptyState label="No upcoming appointments yet. Start a symptom check-in to book one." />
        ) : (
          <div className="appt-list">
            {upcoming.map((a) => (
              <div className="appt-row" key={a.id}>
                <div className="appt-main">
                  <strong>{a.specialty || 'General Practice'}</strong>
                  <div className="appt-meta">
                    {a.provider_name ? `With ${a.provider_name} · ` : 'Provider not yet assigned · '}
                    {a.scheduled_time
                      ? new Date(a.scheduled_time).toLocaleString()
                      : 'Time to be confirmed'}
                  </div>
                  <div className="appt-meta">{a.reason}</div>
                </div>
                <div className="appt-actions">
                  <UrgencyBadge urgency={a.urgency} />
                  <StatusBadge status={a.status} />
                  <button
                    className="btn btn-danger"
                    disabled={cancellingId === a.id}
                    onClick={() => handleCancel(a.id)}
                  >
                    {cancellingId === a.id ? 'Cancelling…' : 'Cancel'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h3 className="section-title">Past &amp; cancelled</h3>
        {history.length === 0 ? (
          <EmptyState label="Nothing here yet." />
        ) : (
          <div className="appt-list">
            {history.map((a) => (
              <div className="appt-row" key={a.id}>
                <div className="appt-main">
                  <strong>{a.specialty || 'General Practice'}</strong>
                  <div className="appt-meta">{a.reason}</div>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
