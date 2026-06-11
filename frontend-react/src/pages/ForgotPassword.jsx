import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setLoading(true);

    try {
      const res = await api.post('/auth/forgot-password', { email });
      setMessage(res.data.message || 'Revisa tu correo para restablecer tu contraseña');
      setEmail('');
    } catch (err) {
      setError(err.response?.data?.message || 'Error al enviar el correo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-blue-900 text-white p-6 text-center">
          <h1 className="text-2xl font-bold">Recuperar Contraseña</h1>
          <p className="text-blue-200 text-sm mt-1">San José de Tarbes</p>
        </div>
        <div className="p-8">
          <p className="text-gray-600 text-sm mb-6 text-center">
            Ingresa tu correo institucional y te enviaremos un enlace para restablecer tu contraseña.
          </p>
          
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Correo Institucional
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="correo@colegio.edu"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2 px-4 rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Enviar enlace'}
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

          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm text-blue-600 hover:text-blue-800">
              ← Volver al inicio de sesión
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;