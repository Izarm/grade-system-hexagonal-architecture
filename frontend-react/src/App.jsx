import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { RefreshProvider } from './contexts/RefreshContext';
import { setGlobalErrorHandler } from './api/client';
import { useNotification } from './contexts/NotificationContext';
import { useEffect, lazy, Suspense } from 'react';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

const AdminDashboard  = lazy(() => import('./pages/AdminDashboard'));
const TeacherDashboard = lazy(() => import('./pages/TeacherDashboard'));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="text-center">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
      <p className="text-sm text-gray-500">Cargando...</p>
    </div>
  </div>
);

const ErrorHandlerSetup = () => {
  const { showError } = useNotification();

  useEffect(() => {
    setGlobalErrorHandler(showError);
  }, [showError]);

  return null;
};

function AppRoutes() {
  const { user, loading } = useAuth();

  // Mientras se confirma la sesión con el servidor no se decide nada: sin esto
  // se mandaba al login por un instante aunque la sesión fuera válida.
  if (loading) return <PageLoader />;

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  if (user.role === 'admin') {
    return (
      <Routes>
        <Route path="/admin/*" element={<AdminDashboard />} />
        <Route path="/teacher/*" element={<Navigate to="/admin" />} />
        <Route path="/" element={<Navigate to="/admin" />} />
        <Route path="*" element={<Navigate to="/admin" />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/teacher/*" element={<TeacherDashboard />} />
      <Route path="/admin/*" element={<Navigate to="/teacher" />} />
      <Route path="/" element={<Navigate to="/teacher" />} />
      <Route path="*" element={<Navigate to="/teacher" />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <RefreshProvider>
        <AuthProvider>
          <NotificationProvider>
            <ErrorHandlerSetup />
            <Suspense fallback={<PageLoader />}>
              <AppRoutes />
            </Suspense>
          </NotificationProvider>
        </AuthProvider>
      </RefreshProvider>
    </Router>
  );
}

export default App;