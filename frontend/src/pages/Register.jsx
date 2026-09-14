import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatError } from '../api/client';
import {
  StethoscopeIcon,
  ShieldIcon,
  AlertCircleIcon,
  ArrowRightIcon,
  SparklesIcon,
  EyeIcon,
  EyeOffIcon,
} from '../components/Icons';

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const validate = () => {
    const errs = {};
    if (form.full_name.trim().length < 2) errs.full_name = 'Enter your full name.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Enter a valid email address.';
    if (form.password.length < 8) {
      errs.password = 'Password must be at least 8 characters.';
    } else if (!/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      errs.password = 'Password must include at least one letter and one number.';
    }
    if (form.password !== form.confirm) errs.confirm = 'Passwords do not match.';
    if (form.role === 'provider' && !form.specialty) errs.specialty = 'Select a medical specialty.';
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
      const targetRole = user?.role || form.role || 'patient';
      navigate('/' + targetRole);
    } catch (err) {
      setFormError(formatError(err, 'Unable to create account. Please try again.'));
    }
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
            <SparklesIcon size={14} /> Integrated Care Platform
          </div>
          <h1>One unified portal for modern care teams.</h1>
          <p>
            Patients experience instant symptom triage and scheduling. Healthcare providers
            get conflict-free calendars and clinical summaries.
          </p>

          <div className="hero-stats">
            <div>
              <strong>Instant</strong>
              <span>Care Routing</span>
            </div>
            <div>
              <strong>Secure</strong>
              <span>Protected Data</span>
            </div>
            <div>
              <strong>24 / 7</strong>
              <span>Triage Intake</span>
            </div>
          </div>
        </div>

        <div className="auth-footer-notice">
          <ShieldIcon size={15} />
          Your information is stored securely and never used to generate unreviewed clinical decisions.
        </div>
      </div>

      <div className="auth-form-wrap">
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <h2>Create your account</h2>
          <p className="subtitle">Join CareFlow AI for intelligent care coordination.</p>

          <div className="input-group">
            <label htmlFor="full_name">Full name</label>
            <input
              id="full_name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Dr. Jordan Hayes or Alex Smith"
            />
            {errors.full_name && (
              <div className="error-text" role="alert">
                <AlertCircleIcon size={14} /> {errors.full_name}
              </div>
            )}
          </div>

          <div className="input-group">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
            />
            {errors.email && (
              <div className="error-text" role="alert">
                <AlertCircleIcon size={14} /> {errors.email}
              </div>
            )}
          </div>

          <div className="input-group">
            <label htmlFor="role">Role</label>
            <select
              id="role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="patient">Patient (Seeking Care)</option>
              <option value="provider">Healthcare Provider (Doctor / Clinician)</option>
            </select>
          </div>

          {form.role === 'provider' && (
            <div className="input-group">
              <label htmlFor="specialty">Medical Specialty</label>
              <select
                id="specialty"
                value={form.specialty}
                onChange={(e) => setForm({ ...form, specialty: e.target.value })}
              >
                <option value="">Select a specialty…</option>
                {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.specialty && (
                <div className="error-text" role="alert">
                  <AlertCircleIcon size={14} /> {errors.specialty}
                </div>
              )}
            </div>
          )}

          <div className="input-group">
            <label htmlFor="phone">Phone number (optional)</label>
            <input
              id="phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="(555) 019-2834"
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-wrap">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                aria-describedby="password-hint"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
              </button>
            </div>
            <span id="password-hint" style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              Must contain 8+ characters, with at least 1 letter and 1 number.
            </span>
            {errors.password && (
              <div className="error-text" role="alert">
                <AlertCircleIcon size={14} /> {errors.password}
              </div>
            )}
          </div>

          <div className="input-group">
            <label htmlFor="confirm">Confirm password</label>
            <div className="password-input-wrap">
              <input
                id="confirm"
                type={showConfirm ? 'text' : 'password'}
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                placeholder="••••••••"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowConfirm(!showConfirm)}
                title={showConfirm ? 'Hide password' : 'Show password'}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
              </button>
            </div>
            {errors.confirm && (
              <div className="error-text" role="alert">
                <AlertCircleIcon size={14} /> {errors.confirm}
              </div>
            )}
          </div>

          {formError && (
            <div className="error-text" role="alert" style={{ marginBottom: 14 }}>
              <AlertCircleIcon size={15} /> {formError}
            </div>
          )}

          <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
            {loading ? 'Creating account…' : 'Complete Registration'}
            {!loading && <ArrowRightIcon size={16} />}
          </button>

          <div className="auth-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
