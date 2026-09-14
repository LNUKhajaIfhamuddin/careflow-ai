import { useEffect, useState } from 'react';
import client, { formatError } from '../api/client';
import AppShell from '../components/AppShell';
import { UrgencyBadge, StatusBadge, StatCard, Loader, EmptyState } from '../components/UI';
import {
  CalendarIcon,
  UserIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  PhoneIcon,
  MailIcon,
  SearchIcon,
} from '../components/Icons';
import { useAuth } from '../context/AuthContext';

function getTomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const STATUS_FLOW = {
  pending: 'confirmed',
  confirmed: 'completed',
};
const NEXT_LABEL = {
  pending: 'Confirm Appointment',
  confirmed: 'Mark Completed',
};

export default function ProviderDashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'completed' | 'cancelled'
  const [searchQuery, setSearchQuery] = useState('');

  // Cancel / Decline Modal
  const [apptToCancel, setApptToCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  // Reschedule Modal
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
    setError('');
    setSuccessMsg('');
    try {
      await client.patch(`/api/appointments/${appt.id}`, { status: nextStatus });
      setSuccessMsg(
        nextStatus === 'confirmed'
          ? `Appointment for ${appt.patient_name} has been confirmed.`
          : `Appointment for ${appt.patient_name} marked as completed.`
      );
      await load();
    } catch (err) {
      setError(formatError(err, 'Could not update that appointment.'));
    } finally {
      setUpdatingId(null);
    }
  };

  const confirmCancel = async () => {
    if (!apptToCancel) return;
    setCancelling(true);
    setError('');
    try {
      await client.delete(`/api/appointments/${apptToCancel.id}`);
      setSuccessMsg(`Appointment for ${apptToCancel.patient_name} has been cancelled.`);
      setApptToCancel(null);
      await load();
    } catch (err) {
      setError(formatError(err, 'Could not cancel that appointment.'));
    } finally {
      setCancelling(false);
    }
  };

  // When opening reschedule modal, default to tomorrow's date
  const openRescheduleModal = (appt) => {
    setApptToReschedule(appt);
    setSelectedSlot('');
    setRescheduleError('');
    const dateStr = getTomorrowStr();
    setRescheduleDate(dateStr);
    fetchSlotsForDate(dateStr, appt);
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
          provider_id: user?.id,
          specialty: targetAppt?.specialty || user?.specialty,
          client_time: clientTime,
        },
      });
      setAvailableSlots(res.data.open_slots || []);
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
      setSuccessMsg(`Appointment for ${apptToReschedule.patient_name} rescheduled successfully.`);
      setApptToReschedule(null);
      await load();
    } catch (err) {
      setRescheduleError(formatError(err, 'Could not reschedule appointment.'));
    } finally {
      setRescheduling(false);
    }
  };

  const pending = appointments.filter((a) => a.status === 'pending');
  const confirmed = appointments.filter((a) => a.status === 'confirmed');
  const completed = appointments.filter((a) => a.status === 'completed');
  const cancelled = appointments.filter((a) => a.status === 'cancelled');

  const filteredList = appointments.filter((a) => {
    if (activeTab === 'active') {
      if (a.status !== 'pending' && a.status !== 'confirmed') return false;
    } else if (activeTab === 'completed') {
      if (a.status !== 'completed') return false;
    } else if (activeTab === 'cancelled') {
      if (a.status !== 'cancelled') return false;
    }

    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (a.patient_name && a.patient_name.toLowerCase().includes(query)) ||
      (a.reason && a.reason.toLowerCase().includes(query)) ||
      (a.ai_summary && a.ai_summary.toLowerCase().includes(query))
    );
  });

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1>Clinical Schedule &amp; Triage</h1>
          <p>
            Welcome, Dr. {user?.full_name?.replace(/^Dr\.\s*/i, '') || 'Provider'} ({user?.specialty || 'General Practice'}). Manage patient appointments and update consultation status.
          </p>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Pending Intake" value={pending.length} subtext="Awaiting provider confirmation" />
        <StatCard label="Confirmed" value={confirmed.length} subtext="Ready for consultation" />
        <StatCard label="Completed" value={completed.length} subtext="Finished visits" />
        <StatCard label="Total Patients" value={appointments.length} subtext="All logged visits" />
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

      <div className="card">
        <div className="section-title" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className={activeTab === 'active' ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ padding: '6px 14px', fontSize: '0.84rem' }}
              onClick={() => setActiveTab('active')}
            >
              Active Queue ({pending.length + confirmed.length})
            </button>
            <button
              className={activeTab === 'completed' ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ padding: '6px 14px', fontSize: '0.84rem' }}
              onClick={() => setActiveTab('completed')}
            >
              Completed Visits ({completed.length})
            </button>
            <button
              className={activeTab === 'cancelled' ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ padding: '6px 14px', fontSize: '0.84rem' }}
              onClick={() => setActiveTab('cancelled')}
            >
              Cancelled ({cancelled.length})
            </button>
          </div>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <SearchIcon size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search patient, symptoms…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 30, fontSize: '0.82rem', height: 32, width: 220 }}
            />
          </div>
        </div>

        {loading ? (
          <Loader label="Fetching schedule…" />
        ) : filteredList.length === 0 ? (
          <EmptyState
            label={
              activeTab === 'active'
                ? 'No pending or confirmed appointments in your queue right now.'
                : activeTab === 'completed'
                ? 'No completed appointments on record yet.'
                : 'No cancelled appointments.'
            }
          />
        ) : (
          <div className="appt-list">
            {filteredList.map((a) => {
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
                      <UserIcon size={16} style={{ color: 'var(--primary)' }} />
                      {a.patient_name}
                    </strong>
                    <div className="appt-meta">
                      <CalendarIcon size={14} />
                      <span>{formattedDate} {formattedTime && `at ${formattedTime}`}</span>
                    </div>

                    {(a.patient_phone || a.patient_email) && (
                      <div className="appt-meta" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {a.patient_phone && (
                          <a
                            href={`tel:${a.patient_phone}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 14, color: 'var(--primary)', textDecoration: 'none' }}
                          >
                            <PhoneIcon size={13} /> {a.patient_phone}
                          </a>
                        )}
                        {a.patient_email && (
                          <a
                            href={`mailto:${a.patient_email}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--primary)', textDecoration: 'none' }}
                          >
                            <MailIcon size={13} /> {a.patient_email}
                          </a>
                        )}
                      </div>
                    )}

                    <div className="appt-meta" style={{ color: 'var(--ink)' }}>
                      <span style={{ fontWeight: 600 }}>Clinical reason:</span> {a.reason}
                    </div>
                    {a.ai_summary && (
                      <div className="appt-meta" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <span style={{ fontWeight: 600 }}>AI Note:</span> {a.ai_summary}
                      </div>
                    )}
                  </div>

                  <div className="appt-actions" style={{ flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
                    <UrgencyBadge urgency={a.urgency} />
                    <StatusBadge status={a.status} />

                    {activeTab === 'active' && (
                      <>
                        {STATUS_FLOW[a.status] && (
                          <button
                            className="btn btn-primary"
                            style={{ padding: '7px 14px', fontSize: '0.84rem' }}
                            disabled={updatingId === a.id}
                            onClick={() => advanceStatus(a)}
                          >
                            {updatingId === a.id ? 'Updating…' : NEXT_LABEL[a.status]}
                          </button>
                        )}

                        <button
                          className="btn btn-secondary"
                          style={{ padding: '7px 12px', fontSize: '0.84rem' }}
                          onClick={() => openRescheduleModal(a)}
                        >
                          Reschedule
                        </button>

                        <button
                          className="btn btn-danger"
                          style={{ padding: '7px 12px', fontSize: '0.84rem' }}
                          onClick={() => setApptToCancel(a)}
                        >
                          {a.status === 'pending' ? 'Decline' : 'Cancel'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Decline / Cancel Modal ── */}
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
                <h3 id="modal-cancel-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                  {apptToCancel.status === 'pending' ? 'Decline Consultation' : 'Cancel Appointment'}
                </h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Patient: {apptToCancel.patient_name}
                </p>
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--ink-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
              Are you sure you want to {apptToCancel.status === 'pending' ? 'decline' : 'cancel'} this consultation? The patient will be notified automatically.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={cancelling}
                onClick={() => setApptToCancel(null)}
              >
                Keep Appointment
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={cancelling}
                onClick={confirmCancel}
              >
                {cancelling ? 'Processing…' : apptToCancel.status === 'pending' ? 'Yes, Decline' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reschedule Modal ── */}
      {apptToReschedule && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-reschedule-title"
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
            <h3 id="modal-reschedule-title" style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 600 }}>
              Reschedule Visit: {apptToReschedule.patient_name}
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Select a new date and open interval on your clinical calendar.
            </p>

            {rescheduleError && (
              <div className="error-text" role="alert" style={{ marginBottom: 14 }}>
                <AlertCircleIcon size={15} /> {rescheduleError}
              </div>
            )}

            <div className="input-group" style={{ marginBottom: 16 }}>
              <label htmlFor="resched-date" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, display: 'block' }}>
                Select Consultation Date
              </label>
              <input
                id="resched-date"
                type="date"
                value={rescheduleDate}
                min={new Date().toISOString().split('T')[0]}
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
                  Loading available slots…
                </div>
              ) : availableSlots.length === 0 ? (
                <div style={{ padding: '12px 0', fontSize: '0.85rem', color: 'var(--rose, #e11d48)' }}>
                  No open slots on this date. Please pick another date.
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
