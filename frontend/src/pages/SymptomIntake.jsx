import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import AppShell from '../components/AppShell';
import { UrgencyBadge } from '../components/UI';

export default function SymptomIntake() {
  const navigate = useNavigate();
  const [symptomText, setSymptomText] = useState('');
  const [result, setResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');
  const [preferredTime, setPreferredTime] = useState('');

  const handleAnalyze = async (e) => {
    e.preventDefault();
    setError('');
    if (symptomText.trim().length < 3) {
      setError('Please describe your symptoms in a bit more detail.');
      return;
    }
    setAnalyzing(true);
    setResult(null);
    try {
      const { data } = await client.post('/api/ai/symptom-intake', { symptom_text: symptomText });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'We could not analyze your symptoms right now. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleBook = async () => {
    if (!result) return;
    setBooking(true);
    setError('');
    try {
      await client.post('/api/appointments', {
        reason: result.suggested_reason,
        specialty: result.recommended_specialty,
        urgency: result.urgency,
        ai_summary: result.summary,
        scheduled_time: preferredTime ? new Date(preferredTime).toISOString() : null,
      });
      navigate('/patient');
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not book the appointment. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1>AI symptom check-in</h1>
          <p>
            Describe what you're experiencing in your own words. Our AI assistant will
            suggest the right specialty and urgency level — it does not diagnose conditions.
          </p>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <form onSubmit={handleAnalyze}>
            <div className="input-group">
              <label htmlFor="symptoms">What's going on?</label>
              <textarea
                id="symptoms"
                rows={6}
                maxLength={2000}
                value={symptomText}
                onChange={(e) => setSymptomText(e.target.value)}
                placeholder="e.g. I've had a dull headache and dizziness for the past two days, worse in the mornings."
                aria-describedby="symptom-char-count"
              />
              <span id="symptom-char-count" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                {symptomText.length}/2000
              </span>
            </div>
            {error && <div className="error-text" role="alert">{error}</div>}
            <button className="btn btn-primary" disabled={analyzing}>
              {analyzing ? 'Analyzing…' : 'Analyze symptoms'}
            </button>
          </form>
        </div>

        <div className="card">
          <h3 className="section-title">AI recommendation</h3>
          {!result && !analyzing && (
            <p style={{ color: 'var(--text-muted)' }}>
              Your recommendation will appear here after analysis.
            </p>
          )}
          {analyzing && <p style={{ color: 'var(--text-muted)' }}>Reviewing your description…</p>}
          {result && (
            <div className="triage-result">
              <div className="triage-row">
                <strong>Specialty:</strong> {result.recommended_specialty}
              </div>
              <div className="triage-row">
                <strong>Urgency:</strong> <UrgencyBadge urgency={result.urgency} />
              </div>
              <p style={{ margin: '10px 0 16px', color: 'var(--ink)' }}>{result.summary}</p>

              <div className="input-group">
                <label htmlFor="preferred_time">Preferred appointment time (optional)</label>
                <input
                  id="preferred_time"
                  type="datetime-local"
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                />
              </div>

              <button className="btn btn-primary" onClick={handleBook} disabled={booking} style={{ width: '100%' }}>
                {booking ? 'Booking…' : 'Book this appointment'}
              </button>

              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 10 }}>
                Source: {result.source === 'openai' ? 'OpenAI GPT analysis' : 'Built-in rule-based analyzer (no API key configured)'}
              </p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
