import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const user = await login(form.email, form.password);
      navigate(`/${user.role}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to log in. Please try again.');
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-hero">
        <div className="brand">🩺 CareFlow AI</div>
        <div className="hero-copy">
          <h1>Get patients to the right care, faster.</h1>
          <p>
            AI-assisted symptom intake routes patients to the correct specialty,
            flags urgency, and keeps schedules moving — so your care team spends
            less time coordinating and more time treating.
          </p>
          <div className="hero-stats">
            <div><strong>40%</strong><span>faster scheduling</span></div>
            <div><strong>↓</strong><span>missed appointments</span></div>
            <div><strong>↑</strong><span>routing accuracy</span></div>
          </div>
        </div>
        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
          Decision support only — CareFlow AI does not provide medical diagnoses.
        </div>
      </div>

      <div className="auth-form-wrap">
        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>Welcome back</h2>
          <p className="subtitle">Log in to your CareFlow AI account.</p>

          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
            />
          </div>

          {error && <div className="error-text" role="alert">{error}</div>}

          <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Logging in…' : 'Log in'}
          </button>

          <div className="auth-switch">
            New to CareFlow AI? <Link to="/register">Create an account</Link>
          </div>

          <div className="demo-box">
            <strong>Demo accounts</strong> (run <code>python -m app.seed</code> first):
            <br />Patient: jane.doe@example.com / Patient123!
            <br />Provider: dr.patel@careflow.ai / Provider123!
            <br />Admin: admin@careflow.ai / Admin123!
          </div>
        </form>
      </div>
    </div>
  );
}
