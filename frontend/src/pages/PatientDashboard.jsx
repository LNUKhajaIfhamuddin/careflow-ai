import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client, { formatError } from '../api/client';
import AppShell from '../components/AppShell';
import { UrgencyBadge, StatusBadge, Loader, EmptyState, StatCard } from '../components/UI';
import {
  CalendarIcon,
  PlusIcon,
  StethoscopeIcon,
  UserIcon,
  AlertCircleIcon,
  SparklesIcon,
  CheckCircleIcon,
} from '../components/Icons';
import { useAuth } from '../context/AuthContext';

function getTodayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getTomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function PatientDashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [cancellingId, setCancellingId] = useState(null);
  const [apptToCancel, setApptToCancel] = useState(null);

  // Reschedule state
  const [apptToReschedule, setApptToReschedule] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await client.get('/api/appointments');
      setAppointments(data);
    } catch {
      setError('Could not load your appointments. Please refresh to try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const confirmCancel = async () => {
    if (!apptToCancel) return;
    setCancellingId(apptToCancel.id);
    setSuccessMsg('');
    try {
      await client.delete(`/api/appointments/${apptToCancel.id}`);
      setApptToCancel(null);
      setSuccessMsg('Your appointment has been cancelled.');
      await load();
    } catch {
      setError('Could not cancel that appointment. Please try again.');
    } finally {
      setCancellingId(null);
    }
  };

  const openRescheduleModal = (appt) => {
    setApptToReschedule(appt);
    setSelectedSlot('');
    setRescheduleError('');
    const targetDate = getTomorrowStr();
    setRescheduleDate(targetDate);
    fetchSlotsForDate(targetDate, appt);
  };

  const fetchSlotsForDate = async (dateStr, appt) => {
    setLoadingSlots(true);
    setRescheduleError('');
    try {
      const targetAppt = appt || apptToReschedule;
      const clientTime = new Date().toISOString();
      const res = await client.get('/api/appointments/available-slots', {
        params: {
          date: dateStr,
          provider_id: targetAppt?.provider_id || undefined,
          specialty: targetAppt?.specialty || 'General Practice',
          client_time: clientTime,
        },
      });
      const now = new Date();
      const open = (res.data.open_slots || []).filter((s) => new Date(s.iso) > now);
      setAvailableSlots(open);
    } catch (err) {
      setRescheduleError(formatError(err, 'Could not fetch available slots for this date.'));
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setRescheduleDate(newDate);
    setSelectedSlot('');
    fetchSlotsForDate(newDate);
  };

  const confirmReschedule = async () => {
    if (!apptToReschedule || !selectedSlot) return;
    setRescheduling(true);
    setRescheduleError('');
    try {
      await client.patch(`/api/appointments/${apptToReschedule.id}`, {
        scheduled_time: selectedSlot,
      });
      setSuccessMsg(`Appointment rescheduled successfully to ${new Date(selectedSlot).toLocaleString()}.`);
      setApptToReschedule(null);
      await load();
    } catch (err) {
      setRescheduleError(formatError(err, 'Could not reschedule appointment.'));
    } finally {
      setRescheduling(false);
    }
  };

  const upcoming = appointments.filter((a) => a.status !== 'cancelled' && a.status !== 'completed');
  const history = appointments.filter((a) => a.status === 'cancelled' || a.status === 'completed');

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1>Welcome back, {user?.full_name?.split(' ')[0] || 'Patient'}</h1>
          <p>Review your scheduled care visits, clinical urgency status, or start an AI symptom triage.</p>
        </div>
        <Link to="/patient/symptom-intake" className="btn btn-primary" style={{ padding: '12px 22px' }}>
          <SparklesIcon size={18} />
          <span>New Symptom Check-in</span>
        </Link>
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

      <div className="stat-grid">
        <StatCard
          label="Upcoming Visits"
          value={upcoming.length}
          subtext={upcoming.length > 0 ? 'Next visit active' : 'No upcoming visits'}
        />
        <StatCard
          label="Completed Care"
          value={appointments.filter((a) => a.status === 'completed').length}
          subtext="Past visits concluded"
        />
        <StatCard
          label="Total Records"
          value={appointments.length}
          subtext="All appointments logged"
        />
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <div className="section-title">
          <span>Upcoming Appointments</span>
          <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-muted)' }}>
            {upcoming.length} active
          </span>
        </div>

        {loading ? (
          <Loader label="Loading your appointments…" />
        ) : upcoming.length === 0 ? (
          <EmptyState
            label="You have no upcoming appointments scheduled. Check in with your symptoms to receive an AI recommendation and book a doctor."
            action={
              <Link to="/patient/symptom-intake" className="btn btn-primary">
                <PlusIcon size={16} /> Check symptoms now
              </Link>
            }
          />
        ) : (
          <div className="appt-list">
            {upcoming.map((a) => {
              const dateObj = a.scheduled_time ? new Date(a.scheduled_time) : null;
              const formattedDate = dateObj
                ? dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                : 'Date to be confirmed';
              const formattedTime = dateObj
                ? dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                : '';

              return (
                <div className="appt-row card-hover" key={a.id}>
                  <div className="appt-main">
                    <strong>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          background: 'var(--primary-subtle)',
                          color: 'var(--primary)',
                        }}
                      >
                        <StethoscopeIcon size={16} />
                      </span>
                      {a.specialty || 'General Practice'}
                    </strong>
                    <div className="appt-meta" style={{ marginTop: 4 }}>
                      <CalendarIcon size={15} style={{ color: 'var(--primary)' }} />
                      <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{formattedDate}</span>
                      {formattedTime && <span>· {formattedTime}</span>}
                      <span>·</span>
                      <UserIcon size={15} />
                      <span>
                        {a.provider_name
                          ? (a.provider_name.startsWith('Dr.') ? a.provider_name : `Dr. ${a.provider_name}`)
                          : 'Provider triage pending'}
                      </span>
                    </div>
                    {a.reason && (
                      <div className="appt-meta" style={{ marginTop: 2, color: 'var(--ink-secondary)' }}>
                        <span style={{ fontWeight: 500 }}>Notes:</span> {a.reason}
                      </div>
                    )}
                    {a.ai_summary && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: '8px 12px',
                          background: 'var(--primary-subtle)',
                          border: '1px solid rgba(13, 148, 136, 0.2)',
                          borderRadius: 8,
                          fontSize: '0.82rem',
                          color: 'var(--ink)',
                          lineHeight: 1.45,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--primary)', marginBottom: 3 }}>
                          <SparklesIcon size={13} /> AI Clinical Triage Guidance
                        </div>
                        <div>{a.ai_summary}</div>
                      </div>
                    )}
                  </div>

                  <div className="appt-actions" style={{ flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
                    <UrgencyBadge urgency={a.urgency} />
                    <StatusBadge status={a.status} />
                    <button
                      className="btn btn-outline"
                      style={{ padding: '8px 14px', fontSize: '0.84rem' }}
                      onClick={() => openRescheduleModal(a)}
                    >
                      Reschedule
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '8px 14px', fontSize: '0.84rem' }}
                      disabled={cancellingId === a.id}
                      onClick={() => setApptToCancel(a)}
                    >
                      {cancellingId === a.id ? 'Cancelling…' : 'Cancel'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <div className="section-title">
          <span>Past &amp; Cancelled Appointments</span>
          <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-muted)' }}>
            {history.length} archived
          </span>
        </div>

        {history.length === 0 ? (
          <EmptyState label="No archived or past appointments on record." />
        ) : (
          <div className="appt-list">
            {history.map((a) => (
              <div className="appt-row" key={a.id} style={{ opacity: 0.85, background: 'var(--bg-app)' }}>
                <div className="appt-main">
                  <strong>{a.specialty || 'General Practice'}</strong>
                  <div className="appt-meta">
                    {a.scheduled_time ? new Date(a.scheduled_time).toLocaleString() : 'Past record'}
                    {a.provider_name
                      ? ` · ${a.provider_name.startsWith('Dr.') ? a.provider_name : `Dr. ${a.provider_name}`}`
                      : ''}
                  </div>
                  {a.reason && <div className="appt-meta">{a.reason}</div>}
                  {a.ai_summary && (
                    <div style={{ marginTop: 4, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <span style={{ fontWeight: 600 }}>Triage:</span> {a.ai_summary}
                    </div>
                  )}
                </div>
                <div className="appt-actions">
                  <StatusBadge status={a.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Custom In-App Confirmation Modal (Replaces browser window.confirm popup) ── */}
      {apptToCancel && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-cancel-title"
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
          onClick={() => !cancellingId && setApptToCancel(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: 440,
              width: '100%',
              padding: 24,
              borderRadius: 14,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
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
                <h3 id="modal-cancel-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                  Cancel Appointment
                </h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  This will release your reserved interval
                </p>
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--ink-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
              Are you sure you want to cancel your{' '}
              <strong>{apptToCancel.specialty || 'General Practice'}</strong> visit with{' '}
              <strong>
                {apptToCancel.provider_name
                  ? (apptToCancel.provider_name.startsWith('Dr.') ? apptToCancel.provider_name : `Dr. ${apptToCancel.provider_name}`)
                  : 'the assigned provider'}
              </strong>
              {apptToCancel.scheduled_time && (
                <> on <strong>{new Date(apptToCancel.scheduled_time).toLocaleString()}</strong></>
              )}
              ?
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={Boolean(cancellingId)}
                onClick={() => setApptToCancel(null)}
              >
                Keep Appointment
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={Boolean(cancellingId)}
                onClick={confirmCancel}
              >
                {cancellingId === apptToCancel.id ? 'Cancelling…' : 'Yes, Cancel Visit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reschedule Appointment Modal ── */}
      {apptToReschedule && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-patient-reschedule-title"
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
          onClick={() => !rescheduling && setApptToReschedule(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: 480,
              width: '100%',
              padding: 24,
              borderRadius: 14,
              background: '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="modal-patient-reschedule-title" style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 600 }}>
              Reschedule Appointment
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Move your {apptToReschedule.specialty || 'General Practice'} visit to another 30-minute interval.
            </p>

            {rescheduleError && (
              <div className="error-text" role="alert" style={{ marginBottom: 14 }}>
                <AlertCircleIcon size={15} /> {rescheduleError}
              </div>
            )}

            <div className="input-group" style={{ marginBottom: 16 }}>
              <label htmlFor="patient-resched-date" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, display: 'block' }}>
                Select Appointment Date
              </label>
              <input
                id="patient-resched-date"
                type="date"
                value={rescheduleDate}
                min={getTodayStr()}
                onChange={handleDateChange}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
              />
            </div>

            <div className="input-group" style={{ marginBottom: 20 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, display: 'block' }}>
                Select Open 30-Minute Slot
              </label>

              {loadingSlots ? (
                <div style={{ padding: '12px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Checking available slots…
                </div>
              ) : availableSlots.length === 0 ? (
                <div style={{ padding: '12px 0', fontSize: '0.85rem', color: 'var(--rose, #e11d48)' }}>
                  No open slots on this date. Please choose another day.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                  {availableSlots.map((s) => (
                    <button
                      key={s.iso}
                      type="button"
                      className={selectedSlot === s.iso ? 'btn btn-primary' : 'btn btn-outline'}
                      style={{ padding: '6px 8px', fontSize: '0.78rem' }}
                      onClick={() => setSelectedSlot(s.iso)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={rescheduling}
                onClick={() => setApptToReschedule(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={rescheduling || !selectedSlot}
                onClick={confirmReschedule}
              >
                {rescheduling ? 'Rescheduling…' : 'Confirm New Time'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
