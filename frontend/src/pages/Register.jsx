import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SPECIALTIES = [
  'General Practice', 'Cardiology', 'Dermatology', 'Orthopedics', 'Neurology',
  'Pediatrics', 'Gastroenterology', 'ENT (Ear, Nose & Throat)',
  'Psychiatry / Mental Health', 'Obstetrics & Gynecology',
];

export default function Register() {
  const { register, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: '', email: '', password: '', confirm: '', role: 'patient', specialty: '', phone: '',
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');

  const validate = () => {
    const errs = {};
    if (form.full_name.trim().length < 2) errs.full_name = 'Enter your full name.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Enter a valid email address.';
    // Mirrors the backend's password policy (schemas.py) so users see the
    // real requirement client-side instead of only discovering it after
    // a failed submit.
    if (form.password.length < 8) {
      errs.password = 'Password must be at least 8 characters.';
    } else if (!/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      errs.password = 'Password must include at least one letter and one number.';
    }
    if (form.password !== form.confirm) errs.confirm = 'Passwords do not match.';
    if (form.role === 'provider' && !form.specialty) errs.specialty = 'Select a specialty.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!validate()) return;
    try {
      const user = await register({
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        role: form.role,
        specialty: form.role === 'provider' ? form.specialty : null,
        phone: form.phone || null,
      });
      navigate(`/${user.role}`);
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Unable to create account. Please try again.');
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-hero">
        <div className="brand">🩺 CareFlow AI</div>
        <div className="hero-copy">
          <h1>One account, coordinated care.</h1>
          <p>
            Patients, providers, and administrators each get a dashboard built
            for their role — from AI symptom intake to full operational analytics.
          </p>
        </div>
        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
          Your information is stored securely and never used to generate a diagnosis.
        </div>
      </div>

      <div className="auth-form-wrap">
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <h2>Create your account</h2>
          <p className="subtitle">It takes less than a minute.</p>

          <div className="input-group">
            <label htmlFor="full_name">Full name</label>
            <input
              id="full_name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Jane Doe"
            />
            {errors.full_name && <div className="error-text" role="alert">{errors.full_name}</div>}
          </div>

          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
            />
            {errors.email && <div className="error-text" role="alert">{errors.email}</div>}
          </div>

          <div className="input-group">
            <label htmlFor="role">I am a</label>
            <select
              id="role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="patient">Patient</option>
              <option value="provider">Healthcare Provider</option>
              {/* "Hospital Administrator" intentionally removed from public
                  self-registration — this was a privilege-escalation bug
                  (anyone could create their own admin account). Admin
                  accounts must be provisioned out-of-band (seed script or
                  by an existing admin), matching the backend, which now
                  rejects "admin" from this endpoint outright. */}
            </select>
          </div>

          {form.role === 'provider' && (
            <div className="input-group">
              <label htmlFor="specialty">Specialty</label>
              <select
                id="specialty"
                value={form.specialty}
                onChange={(e) => setForm({ ...form, specialty: e.target.value })}
              >
                <option value="">Select a specialty…</option>
                {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.specialty && <div className="error-text" role="alert">{errors.specialty}</div>}
            </div>
          )}

          <div className="input-group">
            <label htmlFor="phone">Phone (optional)</label>
            <input
              id="phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="(555) 123-4567"
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="At least 8 characters, with a letter and a number"
              aria-describedby="password-hint"
            />
            <span id="password-hint" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              At least 8 characters, including one letter and one number.
            </span>
            {errors.password && <div className="error-text" role="alert">{errors.password}</div>}
          </div>

          <div className="input-group">
            <label htmlFor="confirm">Confirm password</label>
            <input
              id="confirm"
              type="password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              placeholder="Re-enter your password"
            />
            {errors.confirm && <div className="error-text" role="alert">{errors.confirm}</div>}
          </div>

          {formError && <div className="error-text" role="alert">{formError}</div>}

          <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>

          <div className="auth-switch">
            Already have an account? <Link to="/login">Log in</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
