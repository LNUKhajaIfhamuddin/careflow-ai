import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './layout.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Register from './pages/Register';
import PatientDashboard from './pages/PatientDashboard';
import SymptomIntake from './pages/SymptomIntake';
import ProviderDashboard from './pages/ProviderDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';

function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={`/${user.role}`} replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/patient"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <PatientDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/symptom-intake"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <SymptomIntake />
              </ProtectedRoute>
            }
          />

          <Route
            path="/provider"
            element={
              <ProtectedRoute allowedRoles={['provider']}>
                <ProviderDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminUsers />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
