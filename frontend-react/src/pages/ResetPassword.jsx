import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../api/client';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tokenParam = params.get('token');
    if (!tokenParam) {
      setError('Token no válido o expirado');
    } else {
      setToken(tokenParam);
    }
  }, [location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      const res = await api.post('/auth/reset-password', { token, password });
      setMessage(res.data.message || 'Contraseña actualizada exitosamente');
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al restablecer la contraseña');
    } finally {
      setLoading(false);
    }
  };

  if (error && !token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden p-8 text-center">
          <div className="text-red-600 mb-4">❌ {error}</div>
          <Link to="/login" className="text-blue-600 hover:text-blue-800">
            Volver al login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-blue-900 text-white p-6 text-center">
          <h1 className="text-2xl font-bold">Nueva Contraseña</h1>
          <p className="text-blue-200 text-sm mt-1">San José de Tarbes</p>
        </div>
        <div className="p-8">
          <form onSubmit={handleSubmit}>
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nueva Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="••••••••"
                required
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirmar Contraseña
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2 px-4 rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Actualizando...' : 'Restablecer Contraseña'}
            </button>
          </form>

          {message && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm text-center">
              {message}
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm text-center">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;