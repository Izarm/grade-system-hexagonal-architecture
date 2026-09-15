// src/shared/reintentar.js
//
// REINTENTOS ANTE BLOQUEOS DE LA BASE DE DATOS
//
// Cuando se matriculan varios estudiantes al mismo tiempo (por ejemplo desde
// la pantalla de promoción de año, que envía muchos a la vez), cada operación
// abre una transacción y renumera los folios del año lectivo. Dos de esas
// transacciones tocando las mismas filas terminan en:
//
//     Deadlock found when trying to get lock; try restarting transaction
//
// MySQL deshace una de las dos y pide que se reintente. Sin reintento, el
// usuario veía un error 500 y la matrícula simplemente no se guardaba.
//
// Estos dos errores son seguros de reintentar porque MySQL ya deshizo la
// transacción completa: no queda nada a medias.

const ERRORES_REINTENTABLES = new Set([
    'ER_LOCK_DEADLOCK',       // deadlock entre transacciones
    'ER_LOCK_WAIT_TIMEOUT'    // esperó demasiado por un bloqueo
]);

/**
 * Ejecuta una operación y la reintenta si la base de datos reporta un bloqueo.
 *
 * @param {Function} operacion   función async a ejecutar
 * @param {object}   opciones    { intentos, esperaBaseMs }
 */
async function conReintentos(operacion, { intentos = 5, esperaBaseMs = 50 } = {}) {
    let ultimoError;

    for (let intento = 1; intento <= intentos; intento++) {
        try {
            return await operacion();
        } catch (error) {
            if (!ERRORES_REINTENTABLES.has(error?.code)) throw error;

            ultimoError = error;
            if (intento === intentos) break;

            // Espera creciente con un poco de azar, para que dos operaciones
            // que chocaron no vuelvan a intentarlo exactamente a la vez.
            const espera = esperaBaseMs * intento + Math.floor(Math.random() * 40);
            await new Promise(resolver => setTimeout(resolver, espera));
        }
    }

    console.error(`[BLOQUEO] La operación falló tras ${intentos} intentos:`, ultimoError?.code);
    throw ultimoError;
}

module.exports = { conReintentos, ERRORES_REINTENTABLES };
