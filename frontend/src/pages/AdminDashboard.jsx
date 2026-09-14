import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import client from '../api/client';
import AppShell from '../components/AppShell';
import { StatCard, Loader } from '../components/UI';
import { AlertCircleIcon } from '../components/Icons';

const COLORS = ['#0d9488', '#d97706', '#e11d48', '#2563eb', '#06b6d4', '#8b5cf6'];

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

  if (loading) return <AppShell><Loader label="Loading operational analytics…" /></AppShell>;
  if (error) {
    return (
      <AppShell>
        <div className="error-text" role="alert">
          <AlertCircleIcon size={16} /> {error}
        </div>
      </AppShell>
    );
  }

  const specialtyData = Object.entries(data.appointments_by_specialty).map(([name, value]) => ({ name, value }));
  const urgencyData = Object.entries(data.appointments_by_urgency).map(([name, value]) => ({ name, value }));

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1>Hospital Operations Analytics</h1>
          <p>System-wide visibility into patient volume, provider workload, urgency distribution, and specialty demand.</p>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Total Patients" value={data.total_patients} subtext="Active individuals" />
        <StatCard label="Total Providers" value={data.total_providers} subtext="Active clinicians" />
        <StatCard label="Total Appointments" value={data.total_appointments} subtext="All time bookings" />
        <StatCard label="Pending Intake" value={data.pending_appointments} subtext="Awaiting review" />
        <StatCard label="Confirmed Visits" value={data.confirmed_appointments || 0} subtext="Scheduled consultations" />
        <StatCard label="Completed Visits" value={data.completed_appointments} subtext="Successfully concluded" />
        <StatCard label="Cancelled" value={data.cancelled_appointments} subtext="Patient/desk cancelled" />
      </div>

      <div className="two-col">
        <div className="card">
          <div className="section-title">
            <span>Appointments by Medical Specialty</span>
          </div>
          {specialtyData.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No appointment data available yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={specialtyData} layout="vertical" margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                <XAxis type="number" allowDecimals={false} stroke="#94a3b8" />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12, fill: '#475569' }} />
                <Tooltip
                  contentStyle={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                />
                <Bar dataKey="value" fill="#0d9488" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <div className="section-title">
            <span>Distribution by Urgency Level</span>
          </div>
          {urgencyData.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No urgency data recorded yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={urgencyData} dataKey="value" nameKey="name" outerRadius={95} innerRadius={45} paddingAngle={4} label>
                  {urgencyData.map((entry, i) => (
                    <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </AppShell>
  );
}
