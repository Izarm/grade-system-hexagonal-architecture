import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
import { activarMensajesEnEspanol } from './utils/mensajesDeValidacion';

// Los avisos de campo inválido los escribe el navegador en su propio idioma.
// Esto los pasa a español para todos los formularios.
activarMensajesEnEspanol();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);