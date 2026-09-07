import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import client from '../api/client';
import AppShell from '../components/AppShell';
import { StatCard, Loader } from '../components/UI';

const COLORS = ['#0f5c56', '#c9a227', '#e2574c', '#3549a8', '#7aa89f', '#8a6d0f'];

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    client.get('/api/admin/analytics')
      .then((res) => setData(res.data))
      .catch(() => setError('Could not load analytics.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <AppShell><Loader label="Loading analytics…" /></AppShell>;
  if (error) return <AppShell><div className="error-text" role="alert">{error}</div></AppShell>;

  const specialtyData = Object.entries(data.appointments_by_specialty).map(([name, value]) => ({ name, value }));
  const urgencyData = Object.entries(data.appointments_by_urgency).map(([name, value]) => ({ name, value }));

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1>Operations analytics</h1>
          <p>Hospital-wide view of scheduling volume, urgency, and specialty demand.</p>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Total patients" value={data.total_patients} />
        <StatCard label="Total providers" value={data.total_providers} />
        <StatCard label="Total appointments" value={data.total_appointments} />
        <StatCard label="Pending" value={data.pending_appointments} />
        <StatCard label="Completed" value={data.completed_appointments} />
        <StatCard label="Cancelled" value={data.cancelled_appointments} />
      </div>

      <div className="two-col">
        <div className="card">
          <h3 className="section-title">Appointments by specialty</h3>
          {specialtyData.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No appointment data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={specialtyData} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#0f5c56" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h3 className="section-title">Appointments by urgency</h3>
          {urgencyData.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No appointment data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={urgencyData} dataKey="value" nameKey="name" outerRadius={90} label>
                  {urgencyData.map((entry, i) => (
                    <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </AppShell>
  );
}
