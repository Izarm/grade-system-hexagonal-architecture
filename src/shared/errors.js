// src/shared/errors.js
// Errores de aplicación con código HTTP y mensaje en español listo para mostrar.

class AppError extends Error {
    constructor(message, status = 400, field = null) {
        super(message);
        this.name = 'AppError';
        this.status = status;
        this.field = field;
        this.isAppError = true;
    }
}

class ValidationError extends AppError {
    constructor(message, field = null) {
        super(message, 400, field);
        this.name = 'ValidationError';
    }
}

class NotFoundError extends AppError {
    constructor(message = 'El recurso solicitado no existe') {
        super(message, 404);
        this.name = 'NotFoundError';
    }
}

class ConflictError extends AppError {
    constructor(message, field = null) {
        super(message, 409, field);
        this.name = 'ConflictError';
    }
}

/**
 * Traduce errores de MySQL a mensajes entendibles.
 * `contexto` permite personalizar el texto según la entidad que se estaba guardando.
 *
 *   contexto = { estudiante: true }  ->  "Ya existe un estudiante con ese codigo"
 *   contexto = { usuario: true }     ->  "El correo ya esta registrado"
 */
function traducirErrorDeBaseDeDatos(error, contexto = {}) {
    if (!error || !error.code) return null;

    const detalle = `${error.sqlMessage || error.message || ''}`.toLowerCase();

    switch (error.code) {
        case 'ER_DUP_ENTRY': {
            if (detalle.includes('student_code')) {
                return new ConflictError('Ya existe un estudiante con ese código', 'studentCode');
            }
            if (detalle.includes('folio')) {
                return new ConflictError('Ese número de folio ya está asignado a otro estudiante', 'folioNumber');
            }
            if (detalle.includes('email')) {
                return new ConflictError('El correo ya está registrado', 'email');
            }
            if (detalle.includes('document')) {
                return new ConflictError('El documento ya está registrado', 'document');
            }
            if (contexto.estudiante) {
                return new ConflictError('Ya existe un estudiante con esos datos', null);
            }
            return new ConflictError('Ya existe un registro con esos datos', null);
        }

        // Intento de escribir en una columna calculada (full_name / name).
        case 'ER_NON_DEFAULT_VALUE_FOR_GENERATED_COLUMN':
            return new AppError(
                'El nombre completo se calcula automáticamente a partir de apellidos y nombres. ' +
                'Envía los campos "apellidos" y "nombres" por separado.',
                500
            );

        case 'ER_NO_REFERENCED_ROW':
        case 'ER_NO_REFERENCED_ROW_2':
            return new ValidationError('Uno de los datos relacionados no existe o fue eliminado');

        case 'ER_ROW_IS_REFERENCED':
        case 'ER_ROW_IS_REFERENCED_2':
            return new ConflictError('No se puede eliminar: el registro está siendo usado en otra parte del sistema');

        case 'ER_DATA_TOO_LONG':
            return new ValidationError('Uno de los campos supera la longitud permitida');

        case 'ER_BAD_NULL_ERROR':
            return new ValidationError('Falta un campo obligatorio');

        case 'ER_LOCK_DEADLOCK':
        case 'ER_LOCK_WAIT_TIMEOUT':
            // Solo llega aquí si los reintentos automáticos ya se agotaron.
            return new AppError(
                'La base de datos está muy ocupada en este momento. Espera unos segundos e intenta de nuevo.',
                503
            );

        case 'ECONNREFUSED':
        case 'PROTOCOL_CONNECTION_LOST':
        case 'ER_CON_COUNT_ERROR':
            return new AppError('No hay conexión con la base de datos. Intenta de nuevo en unos segundos.', 503);

        default:
            return null;
    }
}

/**
 * Convierte cualquier error en una respuesta HTTP coherente.
 * Uso en un controlador:
 *
 *   } catch (error) {
 *       return responderError(res, error, { estudiante: true });
 *   }
 */
function responderError(res, error, contexto = {}) {
    // En descargas (Word, Excel, ZIP) la respuesta puede haber empezado ya.
    // En ese caso no se puede enviar JSON: solo se registra y se corta.
    if (res.headersSent) {
        console.error('[ERROR DESPUES DE EMPEZAR LA DESCARGA]', error);
        return res.end();
    }

    const traducido = traducirErrorDeBaseDeDatos(error, contexto);
    const final = traducido || error;

    if (final.isAppError) {
        const cuerpo = { message: final.message };
        if (final.field) cuerpo.field = final.field;
        return res.status(final.status).json(cuerpo);
    }

    // Error no previsto: se registra completo en el servidor,
    // pero al usuario solo le llega un mensaje genérico.
    console.error('[ERROR NO CONTROLADO]', error);
    return res.status(500).json({
        message: 'Ocurrió un error inesperado en el servidor. Intenta de nuevo.'
    });
}

module.exports = {
    AppError,
    ValidationError,
    NotFoundError,
    ConflictError,
    traducirErrorDeBaseDeDatos,
    responderError
};
