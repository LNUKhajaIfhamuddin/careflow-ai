import { useEffect, useState } from 'react';
import client, { formatError } from '../api/client';
import AppShell from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { UrgencyBadge, StatusBadge, Loader, EmptyState } from '../components/UI';
import {
  CalendarIcon,
  UserIcon,
  UsersIcon,
  AlertCircleIcon,
  ShieldIcon,
  StethoscopeIcon,
  PhoneIcon,
  MailIcon,
  SearchIcon,
  CheckCircleIcon,
} from '../components/Icons';

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [tab, setTab] = useState('appointments');

  // Users Tab Filters
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Appointments Tab Filters
  const [apptSearch, setApptSearch] = useState('');
  const [apptStatusFilter, setApptStatusFilter] = useState('all');

  // User Deactivation Modal
  const [userToDeactivate, setUserToDeactivate] = useState(null);
  const [deactivating, setDeactivating] = useState(false);

  // Assign Doctor Modal
  const [assignAppt, setAssignAppt] = useState(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Cancel Appointment Modal
  const [apptToCancel, setApptToCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [uRes, aRes] = await Promise.all([
        client.get('/api/admin/users'),
        client.get('/api/appointments'),
      ]);
      setUsers(uRes.data);
      setAppointments(aRes.data);
    } catch {
      setError('Could not load administrative data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDeactivate = (id) => {
    const u = users.find((user) => user.id === id);
    if (u) setUserToDeactivate(u);
  };

  const confirmDeactivate = async () => {
    if (!userToDeactivate) return;
    setDeactivating(true);
    setError('');
    try {
      await client.patch(`/api/admin/users/${userToDeactivate.id}/deactivate`);
      setSuccessMsg(`Account for ${userToDeactivate.full_name} has been deactivated.`);
      setUserToDeactivate(null);
      await load();
    } catch (err) {
      setError(formatError(err, 'Could not deactivate that user.'));
    } finally {
      setDeactivating(false);
    }
  };

  const handleActivate = async (user) => {
    setError('');
    try {
      await client.patch(`/api/admin/users/${user.id}/activate`);
      setSuccessMsg(`Account for ${user.full_name} has been reactivated.`);
      await load();
    } catch (err) {
      setError(formatError(err, 'Could not reactivate that user.'));
    }
  };

  const handleOpenAssign = (appt) => {
    setAssignAppt(appt);
    setSelectedDoctorId(appt.provider_id ? String(appt.provider_id) : '');
  };

  const confirmAssign = async () => {
    if (!assignAppt || !selectedDoctorId) return;
    setAssigning(true);
    setError('');
    try {
      await client.patch(`/api/appointments/${assignAppt.id}`, {
        provider_id: parseInt(selectedDoctorId, 10),
      });
      setSuccessMsg(`Provider assigned successfully to appointment #${assignAppt.id}.`);
      setAssignAppt(null);
      await load();
    } catch (err) {
      setError(formatError(err, 'Could not assign that provider.'));
    } finally {
      setAssigning(false);
    }
  };

  const confirmCancelAppt = async () => {
    if (!apptToCancel) return;
    setCancelling(true);
    setError('');
    try {
      await client.delete(`/api/appointments/${apptToCancel.id}`);
      setSuccessMsg(`Appointment #${apptToCancel.id} has been cancelled.`);
      setApptToCancel(null);
      await load();
    } catch (err) {
      setError(formatError(err, 'Could not cancel this appointment.'));
    } finally {
      setCancelling(false);
    }
  };

  const handleUpdateStatus = async (appt, newStatus) => {
    setError('');
    try {
      await client.patch(`/api/appointments/${appt.id}`, { status: newStatus });
      setSuccessMsg(`Appointment #${appt.id} marked as ${newStatus}.`);
      await load();
    } catch (err) {
      setError(formatError(err, `Could not update status to ${newStatus}.`));
    }
  };

  // Active providers for assignment dropdown
  const activeProviders = users.filter(
    (u) => u.role === 'provider' && u.is_active
  );

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.specialty && u.specialty.toLowerCase().includes(userSearch.toLowerCase()));
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Filtered Appointments
  const filteredAppointments = appointments.filter((a) => {
    const matchesSearch =
      (a.patient_name && a.patient_name.toLowerCase().includes(apptSearch.toLowerCase())) ||
      (a.provider_name && a.provider_name.toLowerCase().includes(apptSearch.toLowerCase())) ||
      (a.specialty && a.specialty.toLowerCase().includes(apptSearch.toLowerCase())) ||
      (a.reason && a.reason.toLowerCase().includes(apptSearch.toLowerCase()));
    const matchesStatus = apptStatusFilter === 'all' || a.status === apptStatusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1>Hospital User &amp; Appointment Administration</h1>
          <p>Supervise user credentials, clinical provider assignments, and active patient appointments across departments.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <button
          className={tab === 'appointments' ? 'btn btn-primary' : 'btn btn-secondary'}
          onClick={() => { setTab('appointments'); setError(''); setSuccessMsg(''); }}
        >
          <CalendarIcon size={16} />
          Appointments ({appointments.length})
        </button>
        <button
          className={tab === 'users' ? 'btn btn-primary' : 'btn btn-secondary'}
          onClick={() => { setTab('users'); setError(''); setSuccessMsg(''); }}
        >
          <UsersIcon size={16} />
          Users Directory ({users.length})
        </button>
      </div>

      {error && (
        <div className="error-text" role="alert" style={{ marginBottom: 20 }}>
          <AlertCircleIcon size={16} /> {error}
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          style={{
            padding: '10px 14px',
            marginBottom: 20,
            borderRadius: 8,
            background: 'var(--teal-subtle, #ecfdf5)',
            border: '1px solid var(--teal, #10b981)',
            color: 'var(--teal-dark, #065f46)',
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CheckCircleIcon size={16} /> {successMsg}
        </div>
      )}

      {loading ? (
        <Loader label="Fetching administrative records…" />
      ) : tab === 'appointments' ? (
        <div className="card">
          <div className="section-title" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <div>
              <span>All Hospital Appointments</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: 8 }}>
                {filteredAppointments.length} matching
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <SearchIcon size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="Search patient, doctor, reason…"
                  value={apptSearch}
                  onChange={(e) => setApptSearch(e.target.value)}
                  style={{ paddingLeft: 30, fontSize: '0.82rem', height: 32, width: 220 }}
                />
              </div>
              <select
                value={apptStatusFilter}
                onChange={(e) => setApptStatusFilter(e.target.value)}
                style={{ fontSize: '0.82rem', height: 32, padding: '0 8px' }}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {filteredAppointments.length === 0 ? (
            <EmptyState label="No appointments match your search criteria." />
          ) : (
            <div className="appt-list">
              {filteredAppointments.map((a) => {
                const dateObj = a.scheduled_time ? new Date(a.scheduled_time) : null;
                const formattedDate = dateObj ? dateObj.toLocaleString() : 'Time not specified';
                const canCancel = a.status !== 'cancelled' && a.status !== 'completed';

                return (
                  <div className="appt-row card-hover" key={a.id}>
                    <div className="appt-main">
                      <strong>
                        <UserIcon size={16} style={{ color: 'var(--primary)' }} />
                        {a.patient_name} → {a.specialty || 'General Practice'}
                      </strong>
                      <div className="appt-meta">
                        <CalendarIcon size={14} />
                        <span>{formattedDate}</span>
                        <span>·</span>
                        <span style={{ fontWeight: 600, color: a.provider_name ? 'var(--ink)' : 'var(--amber, #d97706)' }}>
                          {a.provider_name
                            ? (a.provider_name.startsWith('Dr.') ? a.provider_name : `Dr. ${a.provider_name}`)
                            : '⚠️ No provider assigned'}
                        </span>
                      </div>
                      {(a.patient_email || a.patient_phone) && (
                        <div className="appt-meta" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {a.patient_phone && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 12 }}>
                              <PhoneIcon size={12} /> {a.patient_phone}
                            </span>
                          )}
                          {a.patient_email && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <MailIcon size={12} /> {a.patient_email}
                            </span>
                          )}
                        </div>
                      )}
                      {a.reason && (
                        <div className="appt-meta" style={{ color: 'var(--ink-secondary)' }}>
                          <span style={{ fontWeight: 600 }}>Reason:</span> {a.reason}
                        </div>
                      )}
                    </div>
                    <div className="appt-actions" style={{ flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
                      <UrgencyBadge urgency={a.urgency} />
                      <StatusBadge status={a.status} />

                      {a.status === 'pending' && (
                        <button
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                          onClick={() => handleUpdateStatus(a, 'confirmed')}
                        >
                          Confirm Visit
                        </button>
                      )}

                      {a.status === 'confirmed' && (
                        <button
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                          onClick={() => handleUpdateStatus(a, 'completed')}
                        >
                          Mark Completed
                        </button>
                      )}

                      {a.status !== 'completed' && a.status !== 'cancelled' && (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                          onClick={() => handleOpenAssign(a)}
                        >
                          {a.provider_id ? 'Reassign Doctor' : 'Assign Doctor'}
                        </button>
                      )}

                      {canCancel && (
                        <button
                          className="btn btn-danger"
                          style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                          onClick={() => setApptToCancel(a)}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="section-title" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <div>
              <span>Registered Hospital Accounts</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: 8 }}>
                {filteredUsers.length} matching
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <SearchIcon size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="Search name, email, specialty…"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  style={{ paddingLeft: 30, fontSize: '0.82rem', height: 32, width: 220 }}
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                style={{ fontSize: '0.82rem', height: 32, padding: '0 8px' }}
              >
                <option value="all">All Roles</option>
                <option value="provider">Clinicians (Providers)</option>
                <option value="patient">Patients</option>
                <option value="admin">Administrators</option>
              </select>
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <EmptyState label="No users match your filter criteria." />
          ) : (
            <div className="appt-list">
              {filteredUsers.map((u) => {
                const isSelf = currentUser && u.id === currentUser.id;

                return (
                  <div className="appt-row card-hover" key={u.id}>
                    <div className="appt-main">
                      <strong>
                        {u.role === 'admin' ? (
                          <ShieldIcon size={16} style={{ color: 'var(--amber)' }} />
                        ) : u.role === 'provider' ? (
                          <StethoscopeIcon size={16} style={{ color: 'var(--primary)' }} />
                        ) : (
                          <UserIcon size={16} style={{ color: 'var(--blue)' }} />
                        )}
                        {u.full_name}
                        {isSelf && (
                          <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: 6 }}>
                            (You)
                          </span>
                        )}
                      </strong>
                      <div className="appt-meta">
                        <span>{u.email}</span>
                        <span>·</span>
                        <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{u.role}</span>
                        {u.specialty && <span>· {u.specialty}</span>}
                        {u.phone && <span>· {u.phone}</span>}
                      </div>
                    </div>
                    <div className="appt-actions" style={{ gap: 10, alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '3px 10px',
                          borderRadius: 999,
                          background: u.is_active ? '#ecfdf5' : '#f1f5f9',
                          color: u.is_active ? '#065f46' : '#64748b',
                          border: `1px solid ${u.is_active ? '#a7f3d0' : '#cbd5e1'}`,
                        }}
                      >
                        {u.is_active ? 'Active' : 'Deactivated'}
                      </span>

                      {u.is_active ? (
                        isSelf ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Protected</span>
                        ) : (
                          <button
                            className="btn btn-danger"
                            style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                            onClick={() => handleDeactivate(u.id)}
                          >
                            Deactivate
                          </button>
                        )
                      ) : (
                        <button
                          className="btn btn-outline"
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.82rem',
                            color: 'var(--primary)',
                            borderColor: 'var(--primary)',
                          }}
                          onClick={() => handleActivate(u)}
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Assign Doctor Modal ── */}
      {assignAppt && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-assign-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => !assigning && setAssignAppt(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: 460,
              width: '100%',
              padding: 24,
              borderRadius: 14,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              background: '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="modal-assign-title" style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 600 }}>
              Assign Clinician to Appointment #{assignAppt.id}
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Patient: <strong>{assignAppt.patient_name}</strong> · Specialty: <strong>{assignAppt.specialty || 'General Practice'}</strong>
            </p>

            <div className="input-group" style={{ marginBottom: 20 }}>
              <label htmlFor="doctor-select" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, display: 'block' }}>
                Select Active Doctor
              </label>
              {(() => {
                const matchingProviders = activeProviders.filter(
                  (p) => !assignAppt.specialty || p.specialty?.trim().toLowerCase() === assignAppt.specialty?.trim().toLowerCase()
                );
                return (
                  <>
                    <select
                      id="doctor-select"
                      value={selectedDoctorId}
                      onChange={(e) => setSelectedDoctorId(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: '0.9rem' }}
                    >
                      <option value="">-- Choose a Clinician --</option>
                      {matchingProviders.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name} ({p.specialty || 'General Practice'})
                        </option>
                      ))}
                    </select>
                    {matchingProviders.length === 0 && (
                      <div style={{ marginTop: 8, fontSize: '0.82rem', color: 'var(--amber, #d97706)' }}>
                        No active clinicians registered under {assignAppt.specialty || 'General Practice'}. You can register or activate a clinician in this specialty from the Users Directory tab.
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={assigning}
                onClick={() => setAssignAppt(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={assigning || !selectedDoctorId}
                onClick={confirmAssign}
              >
                {assigning ? 'Assigning…' : 'Save Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Appointment Modal ── */}
      {apptToCancel && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-cancel-appt-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => !cancelling && setApptToCancel(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: 440,
              width: '100%',
              padding: 24,
              borderRadius: 14,
              background: '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  background: '#ffe4e6',
                  color: '#e11d48',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertCircleIcon size={22} />
              </div>
              <div>
                <h3 id="modal-cancel-appt-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                  Cancel Appointment #{apptToCancel.id}
                </h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Administrative cancellation
                </p>
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--ink-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
              Are you sure you want to cancel the appointment for <strong>{apptToCancel.patient_name}</strong>? Both the patient and assigned doctor will be notified.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={cancelling}
                onClick={() => setApptToCancel(null)}
              >
                Keep Active
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={cancelling}
                onClick={confirmCancelAppt}
              >
                {cancelling ? 'Cancelling…' : 'Yes, Cancel Appointment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── User Deactivate Modal ── */}
      {userToDeactivate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-deactivate-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => !deactivating && setUserToDeactivate(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: 440,
              width: '100%',
              padding: 24,
              borderRadius: 14,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              background: '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  background: 'var(--rose-subtle, #ffe4e6)',
                  color: 'var(--rose, #e11d48)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertCircleIcon size={22} />
              </div>
              <div>
                <h3 id="modal-deactivate-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                  Deactivate User Account
                </h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Administrative access control
                </p>
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--ink-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
              Are you sure you want to deactivate the account for{' '}
              <strong>{userToDeactivate.full_name}</strong> ({userToDeactivate.email})? They will immediately be barred from signing in and making requests.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={deactivating}
                onClick={() => setUserToDeactivate(null)}
              >
                Keep Active
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={deactivating}
                onClick={confirmDeactivate}
              >
                {deactivating ? 'Deactivating…' : 'Yes, Deactivate Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
