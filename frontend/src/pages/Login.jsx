import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatError } from '../api/client';
import {
  StethoscopeIcon,
  SparklesIcon,
  ShieldIcon,
  AlertCircleIcon,
  ArrowRightIcon,
  CheckIcon,
} from '../components/Icons';

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [activePersona, setActivePersona] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const user = await login(form.email, form.password);
      navigate(`/${user.role}`);
    } catch (err) {
      setError(formatError(err, 'Unable to log in. Please check your credentials.'));
    }
  };

  const handleSelectDemo = (persona, email, password) => {
    setForm({ email, password });
    setActivePersona(persona);
    setError('');
  };

  return (
    <div className="auth-shell">
      <div className="auth-hero">
        <div className="brand">
          <div className="brand-icon-wrap">
            <StethoscopeIcon size={22} />
          </div>
          <span>CareFlow AI</span>
          <span className="brand-badge">Clinical v2.0</span>
        </div>

        <div className="hero-copy">
          <div className="hero-badge">
            <SparklesIcon size={14} /> Intelligent Care Triage
          </div>
          <h1>Get patients to the right care, faster.</h1>
          <p>
            AI-assisted symptom triage matches patients to the right medical specialty,
            flags clinical urgency in real-time, and streamlines doctor schedules with zero double-booking.
          </p>

          <div className="hero-stats">
            <div>
              <strong>40%</strong>
              <span>Faster Scheduling</span>
            </div>
            <div>
              <strong>0%</strong>
              <span>Double-Bookings</span>
            </div>
            <div>
              <strong>99.4%</strong>
              <span>Triage Routing</span>
            </div>
          </div>
        </div>

        <div className="auth-footer-notice">
          <ShieldIcon size={15} />
          Decision support only — CareFlow AI does not substitute for licensed clinical diagnosis.
        </div>
      </div>

      <div className="auth-form-wrap">
        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>Welcome back</h2>
          <p className="subtitle">Sign in to coordinate patient care and schedules.</p>

          <div className="input-group">
            <label htmlFor="email">Work or Patient Email</label>
            <input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => {
                setForm({ ...form, email: e.target.value });
                setActivePersona(null);
              }}
              placeholder="name@hospital.com"
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              value={form.password}
              onChange={(e) => {
                setForm({ ...form, password: e.target.value });
                setActivePersona(null);
              }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="error-text" role="alert">
              <AlertCircleIcon size={15} />
              <span>{error}</span>
            </div>
          )}

          <button className="btn btn-primary" style={{ width: '100%', marginTop: 6 }} disabled={loading}>
            {loading ? 'Authenticating…' : 'Sign in to Dashboard'}
            {!loading && <ArrowRightIcon size={16} />}
          </button>

          <div className="auth-switch">
            New to CareFlow AI? <Link to="/register">Create an account</Link>
          </div>

          <div className="demo-box">
            <div className="demo-title">
              <span>Demo Personas (Click to autofill)</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Instant access</span>
            </div>

            <div className="demo-btn-group">
              <button
                type="button"
                className="demo-persona-card"
                style={activePersona === 'patient' ? { borderColor: 'var(--primary)', background: 'var(--primary-subtle)' } : {}}
                onClick={() => handleSelectDemo('patient', 'khaja.patient@gmail.com', 'khaja1234')}
              >
                <div className="demo-persona-meta">
                  <span className="demo-persona-name">👤 Patient · Khaja Patient</span>
                  <span className="demo-persona-email">khaja.patient@gmail.com</span>
                </div>
                {activePersona === 'patient' ? <CheckIcon size={16} color="var(--primary)" /> : <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Select</span>}
              </button>

              <button
                type="button"
                className="demo-persona-card"
                style={activePersona === 'provider' ? { borderColor: 'var(--primary)', background: 'var(--primary-subtle)' } : {}}
                onClick={() => handleSelectDemo('provider', 'khaja.provider@gmail.com', 'khaja1234')}
              >
                <div className="demo-persona-meta">
                  <span className="demo-persona-name">🩺 Provider · Dr. Khaja (Cardiology)</span>
                  <span className="demo-persona-email">khaja.provider@gmail.com</span>
                </div>
                {activePersona === 'provider' ? <CheckIcon size={16} color="var(--primary)" /> : <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Select</span>}
              </button>

              <button
                type="button"
                className="demo-persona-card"
                style={activePersona === 'admin' ? { borderColor: 'var(--primary)', background: 'var(--primary-subtle)' } : {}}
                onClick={() => handleSelectDemo('admin', 'khaja.admin@gmail.com', 'khaja1234')}
              >
                <div className="demo-persona-meta">
                  <span className="demo-persona-name">⚙️ Hospital Admin · Khaja Admin</span>
                  <span className="demo-persona-email">khaja.admin@gmail.com</span>
                </div>
                {activePersona === 'admin' ? <CheckIcon size={16} color="var(--primary)" /> : <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Select</span>}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
