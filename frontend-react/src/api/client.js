import axios from 'axios';

let globalShowError = null;

export const setGlobalErrorHandler = (handler) => {
  globalShowError = handler;
};

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
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
    } else {
      console.error('Error:', errorMessage);
    }
    
    return Promise.reject(error);
  }
);

export default api;