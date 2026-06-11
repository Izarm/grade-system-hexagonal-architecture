import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';

const Login = () => {
  const [activeTab, setActiveTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [regName, setRegName] = useState('');
  const [regDocument, setRegDocument] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState('docente');
  const [regMessage, setRegMessage] = useState(null);
  const [regLoading, setRegLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.role === 'admin') navigate('/admin');
      else navigate('/teacher');
    } catch (err) {
      setError(err.response?.data?.message || 'Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegMessage(null);
    setRegLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await api.post('/auth/register', {
        name: regName, document: regDocument, email: regEmail,
        phone: regPhone || null, password: regPassword, role: regRole
      }, { headers });

      setRegMessage({ type: 'success', text: res.data.message || 'Usuario registrado exitosamente' });
      setRegName(''); setRegDocument(''); setRegEmail('');
      setRegPhone(''); setRegPassword(''); setRegRole('docente');
      setTimeout(() => { setActiveTab('login'); setRegMessage(null); }, 2000);
    } catch (err) {
      setRegMessage({ type: 'error', text: err.response?.data?.message || 'Error al registrar usuario' });
    } finally {
      setRegLoading(false);
    }
  };

  const inputClass = "w-full px-3.5 py-2.5 border border-gray-200 rounded-md text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white transition";

  return (
    <div className="min-h-screen flex bg-slate-50">

      {/* Panel izquierdo — decorativo */}
      <div className="hidden lg:flex lg:w-[32%] flex-col justify-between bg-gradient-to-br from-blue-800 via-blue-700 to-blue-600 px-10 py-16">
        <div>
          <div className="inline-block px-3 py-1 bg-white/10 border border-white/15 rounded-full text-blue-100 text-xs tracking-widest uppercase mb-10">
            Gestión Académica
          </div>
          <h2 className="text-white text-3xl font-light leading-snug">
            Colegio<br />
            <span className="font-bold">San José de Tarbes</span>
          </h2>
          <p className="text-blue-100/75 text-sm mt-4 leading-relaxed max-w-xs">
            Plataforma institucional para la administración y seguimiento académico.
          </p>
        </div>

        <div className="border-t border-white/15 pt-6">
          <p className="text-blue-100/55 text-xs">
            © {new Date().getFullYear()} Colegio San José de Tarbes
          </p>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-[0_24px_70px_rgba(15,23,42,0.10)] p-8">

          {/* Encabezado */}
          <div className="mb-8">
            <h1 className="text-xl font-bold text-gray-900">Bienvenido</h1>
            <p className="text-sm text-gray-500 mt-1">
              Accede con tus credenciales institucionales
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-7 bg-slate-100 border border-slate-200 rounded-xl p-1">
            {[
              { id: 'login', label: 'Iniciar sesión' },
              { id: 'register', label: 'Registrarse' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* LOGIN */}
          {activeTab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Correo institucional
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="correo@colegio.edu"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass + ' pr-10'}
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-500"
                    tabIndex={-1}
                  >
                    {showPassword
                      ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                    }
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 text-red-600 rounded-md text-xs">
                  <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2.5 px-4 rounded-md text-sm transition-colors disabled:opacity-60 mt-1"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Verificando...
                  </span>
                ) : 'Ingresar'}
              </button>

              <div className="text-right">
                <Link to="/forgot-password" className="text-xs text-blue-600 hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            </form>
          )}

          {/* REGISTRO */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3">
              {[
                { label: 'Nombre completo', value: regName, setter: setRegName, type: 'text', placeholder: 'Nombre completo', required: true },
                { label: 'Documento de identidad', value: regDocument, setter: setRegDocument, type: 'text', placeholder: 'Número de documento', required: true },
                { label: 'Correo electrónico', value: regEmail, setter: setRegEmail, type: 'email', placeholder: 'correo@ejemplo.com', required: true },
                { label: 'Teléfono (opcional)', value: regPhone, setter: setRegPhone, type: 'tel', placeholder: 'Teléfono de contacto', required: false },
                { label: 'Contraseña', value: regPassword, setter: setRegPassword, type: 'password', placeholder: '••••••••', required: true },
              ].map(field => (
                <div key={field.label}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                  <input
                    type={field.type}
                    value={field.value}
                    onChange={(e) => field.setter(e.target.value)}
                    className={inputClass}
                    placeholder={field.placeholder}
                    required={field.required}
                  />
                </div>
              ))}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Rol</label>
                <select value={regRole} onChange={(e) => setRegRole(e.target.value)} className={inputClass}>
                  <option value="docente">Docente</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={regLoading}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2.5 px-4 rounded-md text-sm transition-colors disabled:opacity-60 mt-1"
              >
                {regLoading ? 'Enviando solicitud...' : 'Solicitar registro'}
              </button>

              {regMessage && (
                <div className={`flex items-start gap-2 p-3 rounded-md text-xs border ${
                  regMessage.type === 'success'
                    ? 'bg-green-50 border-green-100 text-green-700'
                    : 'bg-red-50 border-red-100 text-red-600'
                }`}>
                  {regMessage.text}
                </div>
              )}

              <p className="text-xs text-gray-400 text-center mt-1">
                El registro requiere aprobación de un administrador
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
