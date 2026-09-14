import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client, { formatError } from '../api/client';
import AppShell from '../components/AppShell';
import { UrgencyBadge } from '../components/UI';
import {
  SparklesIcon,
  CalendarIcon,
  ClockIcon,
  AlertCircleIcon,
  StethoscopeIcon,
} from '../components/Icons';

/** Helper to get today's date in YYYY-MM-DD format. */
function getTodayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Helper to get tomorrow's date in YYYY-MM-DD format. */
function getTomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Format an ISO string to a human-friendly label like "Sep 15, 2:30 PM". */
function friendlySlot(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

const SAMPLE_SYMPTOMS = [
  { label: 'Chest tightness after exercise', text: "I've been experiencing occasional tightness and discomfort in my chest for the past week after going for short jogs." },
  { label: 'Severe migraine & sensitivity', text: "Severe throbbing headache on the right side of my head for 2 days, with nausea and sensitivity to bright lights." },
  { label: 'Lower back stiffness & pain', text: "Sharp lower back pain that started after lifting heavy boxes 3 days ago, making it painful to bend or walk." },
  { label: 'Persistent dry cough & fever', text: "Dry cough that won't go away for over 10 days, accompanied by intermittent mild chills and fatigue." },
];

export default function SymptomIntake() {
  const navigate = useNavigate();
  const [symptomText, setSymptomText] = useState('');
  const [result, setResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [booking, setBooking] = useState(false);
  const [intakeError, setIntakeError] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [preferredTime, setPreferredTime] = useState('');

  // Doctor selector state
  const [providers, setProviders] = useState([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState('');

  // Conflict state
  const [conflict, setConflict] = useState(null);

  // Fetch providers when AI triage completes and recommends a specialty
  useEffect(() => {
    if (!result?.recommended_specialty) return;
    let cancelled = false;
    setProvidersLoading(true);
    client
      .get('/api/users/providers', { params: { specialty: result.recommended_specialty } })
      .then(({ data }) => {
        if (!cancelled) {
          const list = data || [];
          setProviders(list);
          setSelectedProviderId(''); // default to Any available doctor (recommended)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProviders([]);
          setSelectedProviderId('');
        }
      })
      .finally(() => { if (!cancelled) setProvidersLoading(false); });
    return () => { cancelled = true; };
  }, [result?.recommended_specialty]);

  // Fetch available unblocked 30-minute interval slots whenever date, provider, or specialty changes
  useEffect(() => {
    if (!result?.recommended_specialty || !selectedDate) return;
    let cancelled = false;
    setSlotsLoading(true);

    const clientTime = new Date().toISOString();
    client
      .get('/api/appointments/available-slots', {
        params: {
          date: selectedDate,
          specialty: result.recommended_specialty,
          provider_id: selectedProviderId ? Number(selectedProviderId) : undefined,
          client_time: clientTime,
        },
      })
      .then(({ data }) => {
        if (cancelled) return;
        const now = new Date();
        // Client-side safety filter: ensure strictly only future slots can ever be selected
        const open = (data.open_slots || []).filter((s) => {
          const slotTime = new Date(s.iso);
          return slotTime > now;
        });
        setAvailableSlots(open);
        // Automatically select the nearest open slot if none or currently selected is not in open list
        setPreferredTime((curr) => {
          if (open.length === 0) return '';
          const exists = open.some((s) => s.iso === curr);
          return exists ? curr : open[0].iso;
        });
      })
      .catch(() => {
        if (cancelled) return;
        setAvailableSlots([]);
        setPreferredTime('');
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedDate, selectedProviderId, result?.recommended_specialty]);

  const handleDateChange = (newDate) => {
    const today = getTodayStr();
    if (newDate < today) {
      setSelectedDate(today);
      setBookingError('Appointment date cannot be in the past. Date automatically reset to today.');
      return;
    }
    setSelectedDate(newDate);
    setConflict(null);
    setBookingError('');
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    setIntakeError('');
    setConflict(null);
    if (symptomText.trim().length < 3) {
      setIntakeError('Please describe what symptoms you are feeling in a bit more detail.');
      return;
    }
    setAnalyzing(true);
    setResult(null);
    setProviders([]);
    setSelectedProviderId('');
    try {
      const { data } = await client.post('/api/ai/symptom-intake', { symptom_text: symptomText });
      setResult(data);
    } catch (err) {
      setIntakeError(formatError(err, 'We could not analyze your symptoms right now. Please try again.'));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleBook = async () => {
    if (!result) return;
    if (!preferredTime) {
      setBookingError('Please select an available 30-minute appointment slot above.');
      return;
    }
    // Strict validation: slot must be in the future
    if (new Date(preferredTime) <= new Date()) {
      setBookingError('The selected appointment time has already passed. Please select an upcoming slot.');
      return;
    }
    setBooking(true);
    setBookingError('');
    setConflict(null);

    try {
      await client.post('/api/appointments', {
        reason: result.suggested_reason,
        specialty: result.recommended_specialty,
        urgency: result.urgency,
        ai_summary: result.summary,
        scheduled_time: preferredTime,
        provider_id: selectedProviderId ? Number(selectedProviderId) : null,
      });
      navigate('/patient');
    } catch (err) {
      // Handle 409 Conflict — double-booking with suggested alternatives
      if (err.response?.status === 409 && err.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (detail.message) {
          setConflict({
            message: detail.message,
            suggested_slots: detail.suggested_slots || [],
          });
        } else {
          setBookingError(formatError(err, 'Could not book the appointment. Please try again.'));
        }
      } else {
        setBookingError(formatError(err, 'Could not book the appointment. Please try again.'));
      }
    } finally {
      setBooking(false);
    }
  };

  const pickSuggestedSlot = (isoOrDate) => {
    const isoStr = typeof isoOrDate === 'string' ? isoOrDate : new Date(isoOrDate).toISOString();
    setPreferredTime(isoStr);
    if (isoStr.includes('T')) {
      setSelectedDate(isoStr.split('T')[0]);
    }
    setConflict(null);
    setBookingError('');
  };

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1>AI Symptom Check-in &amp; Scheduling</h1>
          <p>
            Describe your symptoms in natural language. Our clinical triage model suggests the
            optimal specialty, flags urgency, and helps you book an open 30-minute provider slot.
          </p>
        </div>
      </div>

      <div className="two-col">
        {/* Left column: Symptom input composer */}
        <div className="card">
          <div className="section-title">
            <span>Describe What You're Experiencing</span>
          </div>

          <form onSubmit={handleAnalyze}>
            <div className="input-group">
              <label htmlFor="symptoms">
                <span>Symptoms, timeline, or severity</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  {symptomText.length} / 2000 chars
                </span>
              </label>
              <textarea
                id="symptoms"
                rows={6}
                maxLength={2000}
                value={symptomText}
                onChange={(e) => setSymptomText(e.target.value)}
                placeholder="e.g. I've had dull headache, mild dizziness, and nausea for 2 days, noticeable mostly in the mornings..."
                style={{ resize: 'vertical', lineHeight: 1.6 }}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink-secondary)', marginBottom: 6 }}>
                💡 Quick examples (click to populate):
              </div>
              <div className="chip-container">
                {SAMPLE_SYMPTOMS.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="prompt-chip"
                    onClick={() => setSymptomText(s.text)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {intakeError && (
              <div className="error-text" role="alert">
                <AlertCircleIcon size={15} /> {intakeError}
              </div>
            )}

            <button
              className="btn btn-primary"
              disabled={analyzing}
              style={{ width: '100%', padding: '12px 20px' }}
            >
              <SparklesIcon size={18} />
              {analyzing ? 'Evaluating Clinical Triage…' : 'Analyze Symptoms with AI'}
            </button>
          </form>
        </div>

        {/* Right column: AI Recommendation & Booking */}
        <div className="card">
          <div className="section-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SparklesIcon size={18} style={{ color: 'var(--primary)' }} />
              Clinical Recommendation
            </span>
          </div>

          {!result && !analyzing && (
            <div className="empty-state" style={{ minHeight: 280 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'var(--primary-subtle)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <SparklesIcon size={26} />
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', textAlign: 'center', maxWidth: 280 }}>
                Type your symptoms on the left and click "Analyze Symptoms" to view recommended specialty, urgency, and available doctors.
              </p>
            </div>
          )}

          {analyzing && (
            <div className="empty-state" style={{ minHeight: 280 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  border: '3px solid #ccfbf1',
                  borderTop: '3px solid #0d9488',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: 12 }}>
                Reviewing clinical markers and guidelines…
              </p>
            </div>
          )}

          {result && (
            <div className="triage-result">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: 12,
                  borderBottom: '1px solid rgba(13, 148, 136, 0.15)',
                  marginBottom: 14,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <StethoscopeIcon size={18} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--ink)' }}>
                    {result.recommended_specialty}
                  </span>
                </div>
                <UrgencyBadge urgency={result.urgency} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  AI Clinical Summary
                </div>
                <p style={{ margin: '6px 0 0', color: 'var(--ink-secondary)', fontSize: '0.92rem', lineHeight: 1.55 }}>
                  {result.summary}
                </p>
              </div>

              {/* ── Doctor selection ──────────────────────────────────── */}
              <div className="input-group">
                <label htmlFor="select_doctor">
                  <span>Assign Doctor</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    {providers.length} in specialty
                  </span>
                </label>
                {providersLoading ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '8px 0' }}>
                    Loading available doctors…
                  </div>
                ) : providers.length === 0 ? (
                  <div
                    role="status"
                    style={{
                      background: 'var(--amber-subtle)',
                      border: '1px solid var(--amber-border)',
                      borderRadius: 8,
                      padding: '10px 14px',
                      fontSize: '0.84rem',
                      color: 'var(--amber)',
                      marginBottom: 8,
                    }}
                  >
                    No registered doctors found in {result.recommended_specialty}. Your appointment will be triaged by the main desk.
                  </div>
                ) : (
                  <select
                    id="select_doctor"
                    value={selectedProviderId}
                    onChange={(e) => {
                      setSelectedProviderId(e.target.value);
                      setConflict(null);
                      setBookingError('');
                    }}
                  >
                    <option value="">Any available doctor (recommended auto-assign)</option>
                    {providers.map((p) => {
                      const cleanName = p.full_name?.replace(/^Dr\.\s*/i, '') || 'Doctor';
                      const isKhaja = p.email === 'khaja.provider@gmail.com';
                      return (
                        <option key={p.id} value={p.id}>
                          {isKhaja ? `⭐ Dr. ${cleanName} (${p.specialty || 'Cardiology'}) — ${p.email}` : `Dr. ${cleanName} (${p.specialty || 'General Practice'}) — ${p.email}`}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              {/* ── Date Selection & Quick Filters ─────────────────── */}
              <div className="input-group">
                <label htmlFor="appointment_date">
                  <span>Appointment Date</span>
                </label>
                <div className="date-quick-chips">
                  <button
                    type="button"
                    className={`date-chip ${selectedDate === getTodayStr() ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedDate(getTodayStr());
                      setConflict(null);
                      setBookingError('');
                    }}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    className={`date-chip ${selectedDate === getTomorrowStr() ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedDate(getTomorrowStr());
                      setConflict(null);
                      setBookingError('');
                    }}
                  >
                    Tomorrow
                  </button>
                </div>
                <input
                  id="appointment_date"
                  type="date"
                  min={getTodayStr()}
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                />
              </div>

              {/* ── 30-min Interval Radio Buttons (Blocked slots excluded) ── */}
              <div className="input-group" style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ margin: 0 }}>
                    <span>Preferred Slot (30-min intervals)</span>
                  </label>
                  {!slotsLoading && (
                    <span style={{ fontSize: '0.78rem', color: availableSlots.length > 0 ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                      {availableSlots.length} open {availableSlots.length === 1 ? 'slot' : 'slots'}
                    </span>
                  )}
                </div>

                {slotsLoading ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <ClockIcon size={16} style={{ color: 'var(--primary)' }} />
                    Checking open provider intervals…
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="empty-slots-notice">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                      <AlertCircleIcon size={16} />
                      <span>No open appointment intervals on this date</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--ink-secondary)' }}>
                      All intervals for {selectedDate} are either in the past or have already been taken. Past and booked slots are excluded.
                    </p>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{
                        alignSelf: 'flex-start',
                        marginTop: 4,
                        fontSize: '0.8rem',
                        padding: '6px 12px',
                        background: '#ffffff',
                        borderColor: 'var(--amber-border)',
                      }}
                      onClick={() => {
                        const d = new Date(selectedDate);
                        d.setDate(d.getDate() + 1);
                        const pad = (n) => String(n).padStart(2, '0');
                        setSelectedDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
                      }}
                    >
                      Check Next Day ➔
                    </button>
                  </div>
                ) : (
                  <div className="slot-radio-grid" role="radiogroup" aria-label="Available appointment intervals">
                    {availableSlots.map((slot, idx) => {
                      const isSelected = preferredTime === slot.iso;
                      const isNearest = idx === 0;
                      return (
                        <label
                          key={slot.iso}
                          className={`slot-radio-card ${isSelected ? 'selected' : ''}`}
                        >
                          <input
                            type="radio"
                            name="appointment_interval_slot"
                            value={slot.iso}
                            checked={isSelected}
                            onChange={() => {
                              setPreferredTime(slot.iso);
                              setBookingError('');
                              setConflict(null);
                            }}
                          />
                          <div className="slot-radio-body">
                            <div className="slot-radio-top">
                              <span className="slot-time-text">{slot.label}</span>
                              {isNearest && <span className="slot-badge-nearest">Nearest</span>}
                            </div>
                            <div className="slot-meta">30-min slot</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Conflict Notice & Suggested Slots ───────────────── */}
              {conflict && (
                <div
                  role="alert"
                  style={{
                    background: 'var(--rose-subtle)',
                    border: '1px solid var(--rose-border)',
                    borderRadius: 10,
                    padding: '14px 16px',
                    marginBottom: 16,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <AlertCircleIcon size={18} style={{ color: 'var(--rose)', flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--rose)', fontSize: '0.9rem' }}>
                        {conflict.message}
                      </div>
                      {conflict.suggested_slots.length > 0 && (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink-secondary)', marginBottom: 8 }}>
                            Click a free alternative slot below to apply:
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {conflict.suggested_slots.map((slot) => (
                              <button
                                key={slot}
                                type="button"
                                className="btn btn-outline"
                                style={{
                                  fontSize: '0.82rem',
                                  padding: '6px 12px',
                                  background: '#ffffff',
                                  borderColor: 'var(--rose-border)',
                                }}
                                onClick={() => pickSuggestedSlot(slot)}
                              >
                                <ClockIcon size={13} style={{ color: 'var(--primary)' }} />
                                {friendlySlot(slot)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Booking Error Display ── */}
              {bookingError && (
                <div
                  role="alert"
                  style={{
                    background: 'var(--rose-subtle)',
                    border: '1px solid var(--rose-border)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    marginBottom: 14,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <AlertCircleIcon size={16} style={{ color: 'var(--rose)', flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1, fontSize: '0.86rem', color: 'var(--rose)', fontWeight: 500, lineHeight: 1.45 }}>
                      {bookingError}
                    </div>
                  </div>
                </div>
              )}

              <button
                className="btn btn-primary"
                onClick={handleBook}
                disabled={booking}
                style={{ width: '100%', padding: '12px 20px', marginTop: 4 }}
              >
                <CalendarIcon size={17} />
                {booking ? 'Reserving Slot…' : 'Confirm & Book Appointment'}
              </button>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 12, textAlign: 'center' }}>
                Engine: {result.source === 'openai' ? 'OpenAI GPT Clinical Triage' : 'Deterministic Clinical Rule Engine'}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
