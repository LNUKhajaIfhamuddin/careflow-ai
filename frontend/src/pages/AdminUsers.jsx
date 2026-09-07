import { useEffect, useState } from 'react';
import client from '../api/client';
import AppShell from '../components/AppShell';
import { UrgencyBadge, StatusBadge, Loader, EmptyState } from '../components/UI';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('appointments');

  const load = async () => {
    setLoading(true);
    try {
      const [usersRes, apptRes] = await Promise.all([
        client.get('/api/admin/users'),
        client.get('/api/appointments'),
      ]);
      setUsers(usersRes.data);
      setAppointments(apptRes.data);
    } catch {
      setError('Could not load administrative data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDeactivate = async (id) => {
    try {
      await client.patch(`/api/admin/users/${id}/deactivate`);
      await load();
    } catch {
      setError('Could not deactivate that user.');
    }
  };

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1>Users &amp; appointments</h1>
          <p>Manage accounts and monitor every appointment across the hospital.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          className={tab === 'appointments' ? 'btn btn-primary' : 'btn btn-secondary'}
          onClick={() => setTab('appointments')}
        >
          Appointments
        </button>
        <button
          className={tab === 'users' ? 'btn btn-primary' : 'btn btn-secondary'}
          onClick={() => setTab('users')}
        >
          Users
        </button>
      </div>

      {error && <div className="error-text" role="alert">{error}</div>}

      {loading ? (
        <Loader />
      ) : tab === 'appointments' ? (
        <div className="card">
          <h3 className="section-title">All appointments</h3>
          {appointments.length === 0 ? (
            <EmptyState label="No appointments in the system yet." />
          ) : (
            <div className="appt-list">
              {appointments.map((a) => (
                <div className="appt-row" key={a.id}>
                  <div className="appt-main">
                    <strong>{a.patient_name}</strong> → {a.specialty || 'General Practice'}
                    <div className="appt-meta">
                      {a.provider_name ? `Provider: ${a.provider_name}` : 'No provider assigned'}
                    </div>
                    <div className="appt-meta">{a.reason}</div>
                  </div>
                  <div className="appt-actions">
                    <UrgencyBadge urgency={a.urgency} />
                    <StatusBadge status={a.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          <h3 className="section-title">All users</h3>
          {users.length === 0 ? (
            <EmptyState label="No users found." />
          ) : (
            <div className="appt-list">
              {users.map((u) => (
                <div className="appt-row" key={u.id}>
                  <div className="appt-main">
                    <strong>{u.full_name}</strong>
                    <div className="appt-meta">{u.email} · {u.role}{u.specialty ? ` · ${u.specialty}` : ''}</div>
                  </div>
                  <div className="appt-actions">
                    <button className="btn btn-danger" onClick={() => handleDeactivate(u.id)}>
                      Deactivate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
