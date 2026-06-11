import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { RefreshProvider } from './contexts/RefreshContext';
import { setGlobalErrorHandler } from './api/client';
import { useNotification } from './contexts/NotificationContext';
import { useEffect } from 'react';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AdminDashboard from './pages/AdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';

const ErrorHandlerSetup = () => {
  const { showError } = useNotification();

  useEffect(() => {
    setGlobalErrorHandler(showError);
  }, [showError]);

  return null;
};

function AppRoutes() {
  const { user } = useAuth();

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
            <AppRoutes />
          </NotificationProvider>
        </AuthProvider>
      </RefreshProvider>
    </Router>
  );
}

export default App;