import axios from 'axios';

let globalShowError = null;

export const setGlobalErrorHandler = (handler) => {
  globalShowError = handler;
};

// URL relativa: funciona en cualquier dominio sin tocar el código.
//   - En producción el backend sirve el frontend, así que /api es el mismo origen.
//   - En desarrollo, vite.config.js redirige /api a http://localhost:3000.
// Antes estaba escrito 'http://localhost:3000/api', así que solo funcionaba
// en la máquina del desarrollador.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' }
});

// Se renueva el token si le quedan menos de 15 minutos y también si acaba de
// vencer: el servidor admite renovar hasta 1 hora después de la expiración, y
// antes esa hora de gracia no se aprovechaba nunca porque aquí se exigía que
// el token siguiera vivo.
const GRACIA_TRAS_VENCER = 60 * 60 * 1000;

function shouldRefreshToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiresIn = payload.exp * 1000 - Date.now();
    if (expiresIn > 0) return expiresIn < 15 * 60 * 1000;
    return -expiresIn < GRACIA_TRAS_VENCER;
  } catch {
    return false;
  }
}

let refreshPromise = null;

async function doRefresh(token) {
  if (refreshPromise) return refreshPromise;
  // Misma URL relativa que el resto de la aplicación. Antes apuntaba a
  // 'http://localhost:3000/api', así que fuera del equipo de desarrollo la
  // renovación fallaba en silencio y la sesión se cerraba a las 2 horas.
  refreshPromise = axios.post(
    `${import.meta.env.VITE_API_URL || '/api'}/auth/refresh`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  ).then(res => {
    localStorage.setItem('token', res.data.token);
    if (res.data.user) localStorage.setItem('user', JSON.stringify(res.data.user));
    return res.data.token;
  }).finally(() => { refreshPromise = null; });
  return refreshPromise;
}

api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('token');
  if (token) {
    let activeToken = token;
    if (shouldRefreshToken(token)) {
      try { activeToken = await doRefresh(token); } catch { /* usa token actual */ }
    }
    config.headers.Authorization = `Bearer ${activeToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    let errorMessage = 'Ocurrió un error inesperado';

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      if (status === 401) {
        errorMessage = 'Sesión expirada. Por favor, inicie sesión nuevamente.';
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // La comprobación de sesión al arrancar ya deja al usuario en el login
        // por su cuenta; recargar encima solo provoca un parpadeo.
        if (!error.config?.validandoSesion) {
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
        }
      } else if (status === 403) {
        errorMessage = 'No tiene permisos para realizar esta acción';
      } else if (status === 404) {
        errorMessage = 'El recurso solicitado no existe';
      } else if (status === 400) {
        errorMessage = data?.message || 'Datos inválidos. Verifique la información.';
      } else if (status === 500) {
        errorMessage = 'Error interno del servidor. Intente más tarde.';
      }
    } else if (error.request) {
      errorMessage = 'No se pudo conectar con el servidor. Verifique su conexión.';
    }

    if (globalShowError) {
      globalShowError(errorMessage);
    }

    return Promise.reject(error);
  }
);

export default api;