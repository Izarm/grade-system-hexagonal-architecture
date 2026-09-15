import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Al abrir la aplicación no basta con leer el usuario guardado: ese dato
  // sobrevive en el navegador aunque el token ya haya vencido, y entonces se
  // pintaba el panel de un usuario que el servidor ya no reconoce. Se confirma
  // contra /auth/me antes de mostrar nada.
  useEffect(() => {
    const guardado = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (!guardado || !token) {
      setLoading(false);
      return;
    }

    let vigente = true;
    const cerrarSesion = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (vigente) setUser(null);
    };

    // `validandoSesion` evita que el interceptor haga su propia redirección:
    // aquí basta con limpiar y dejar que las rutas muestren el login.
    api.get('/auth/me', { validandoSesion: true })
      .then(res => {
        if (!vigente) return;
        const fresco = { ...JSON.parse(guardado), ...res.data };
        localStorage.setItem('user', JSON.stringify(fresco));
        setUser(fresco);
      })
      .catch(err => {
        const estado = err?.response?.status;
        if (estado === 401 || estado === 403) {
          // El servidor respondió y rechazó el token: la sesión ya no existe.
          cerrarSesion();
        } else if (vigente) {
          // Sin respuesta (servidor apagado o sin red) no se puede afirmar que
          // la sesión haya caducado, así que se conserva lo guardado.
          setUser(JSON.parse(guardado));
        }
      })
      .finally(() => { if (vigente) setLoading(false); });

    return () => { vigente = false; };
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, user } = res.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);