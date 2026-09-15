// tests/errores.test.js
//
// Pruebas de la traducción de errores de MySQL a mensajes en español.
// No necesitan base de datos: se simulan los errores que devuelve el driver.
//
// Lo que se protege aquí es que el usuario final nunca vea un código como
// ER_DUP_ENTRY, y que el mensaje diga qué campo corregir.

const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
    AppError, ValidationError, NotFoundError, ConflictError,
    traducirErrorDeBaseDeDatos,
} = require('../src/shared/errors');

// Un error tal como lo entrega mysql2.
const errorMysql = (code, sqlMessage = '') => ({ code, sqlMessage });

describe('clases de error', () => {

    test('AppError lleva estado, campo y la marca que reconoce app.js', () => {
        const e = new AppError('algo falló', 418, 'correo');
        assert.strictEqual(e.status, 418);
        assert.strictEqual(e.field, 'correo');
        assert.strictEqual(e.isAppError, true);
        assert.ok(e instanceof Error);
    });

    test('cada tipo trae su código HTTP', () => {
        assert.strictEqual(new ValidationError('x').status, 400);
        assert.strictEqual(new NotFoundError().status, 404);
        assert.strictEqual(new ConflictError('x').status, 409);
    });

    test('NotFoundError tiene un mensaje por defecto legible', () => {
        assert.match(new NotFoundError().message, /no existe/i);
    });
});

describe('traducirErrorDeBaseDeDatos', () => {

    test('código repetido de estudiante señala el campo del formulario', () => {
        const e = traducirErrorDeBaseDeDatos(
            errorMysql('ER_DUP_ENTRY', "Duplicate entry '2026080' for key 'students.student_code'"));
        assert.strictEqual(e.status, 409);
        assert.strictEqual(e.field, 'studentCode');
        assert.match(e.message, /Ya existe un estudiante/i);
    });

    test('correo repetido señala el campo correo', () => {
        const e = traducirErrorDeBaseDeDatos(
            errorMysql('ER_DUP_ENTRY', "Duplicate entry 'a@b.com' for key 'users.email'"));
        assert.strictEqual(e.field, 'email');
        assert.match(e.message, /correo ya está registrado/i);
    });

    test('folio repetido se explica como folio, no como código', () => {
        const e = traducirErrorDeBaseDeDatos(
            errorMysql('ER_DUP_ENTRY', "Duplicate entry '12' for key 'enrollments.folio_number'"));
        assert.strictEqual(e.field, 'folioNumber');
        assert.match(e.message, /folio/i);
    });

    test('un duplicado sin pista usa el contexto de quien llama', () => {
        const generico = traducirErrorDeBaseDeDatos(errorMysql('ER_DUP_ENTRY', 'Duplicate entry'));
        assert.match(generico.message, /Ya existe un registro/i);

        const conContexto = traducirErrorDeBaseDeDatos(
            errorMysql('ER_DUP_ENTRY', 'Duplicate entry'), { estudiante: true });
        assert.match(conContexto.message, /Ya existe un estudiante/i);
    });

    test('escribir en la columna calculada explica qué enviar en su lugar', () => {
        // full_name y users.name las calcula MySQL a partir de apellidos y
        // nombres; intentar escribirlas es un error de programación, y el
        // mensaje tiene que decir exactamente cómo corregirlo.
        const e = traducirErrorDeBaseDeDatos(errorMysql('ER_NON_DEFAULT_VALUE_FOR_GENERATED_COLUMN'));
        assert.strictEqual(e.status, 500);
        assert.match(e.message, /apellidos/i);
        assert.match(e.message, /nombres/i);
    });

    test('borrar algo que está en uso devuelve conflicto, no error del servidor', () => {
        const e = traducirErrorDeBaseDeDatos(errorMysql('ER_ROW_IS_REFERENCED_2'));
        assert.strictEqual(e.status, 409);
        assert.match(e.message, /siendo usado/i);
    });

    test('referencia inexistente se trata como dato inválido', () => {
        const e = traducirErrorDeBaseDeDatos(errorMysql('ER_NO_REFERENCED_ROW_2'));
        assert.strictEqual(e.status, 400);
    });

    test('base de datos ocupada o caída pide reintentar, con 503', () => {
        for (const code of ['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT', 'ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST']) {
            const e = traducirErrorDeBaseDeDatos(errorMysql(code));
            assert.strictEqual(e.status, 503, code + ' debería dar 503');
            assert.match(e.message, /intenta de nuevo/i);
        }
    });

    test('campo obligatorio vacío y texto demasiado largo son de validación', () => {
        assert.strictEqual(traducirErrorDeBaseDeDatos(errorMysql('ER_BAD_NULL_ERROR')).status, 400);
        assert.strictEqual(traducirErrorDeBaseDeDatos(errorMysql('ER_DATA_TOO_LONG')).status, 400);
    });

    test('un error desconocido devuelve null para que lo trate app.js', () => {
        assert.strictEqual(traducirErrorDeBaseDeDatos(errorMysql('ER_ALGO_RARO')), null);
        assert.strictEqual(traducirErrorDeBaseDeDatos(null), null);
        assert.strictEqual(traducirErrorDeBaseDeDatos(new Error('sin código')), null);
    });

    test('ningún mensaje deja escapar el código técnico de MySQL', () => {
        const codigos = ['ER_DUP_ENTRY', 'ER_NO_REFERENCED_ROW_2', 'ER_ROW_IS_REFERENCED_2',
            'ER_DATA_TOO_LONG', 'ER_BAD_NULL_ERROR', 'ER_LOCK_DEADLOCK', 'ECONNREFUSED',
            'ER_NON_DEFAULT_VALUE_FOR_GENERATED_COLUMN'];
        for (const c of codigos) {
            const e = traducirErrorDeBaseDeDatos(errorMysql(c, 'Duplicate entry'));
            assert.ok(e, c + ' debería traducirse');
            assert.ok(!/ER_|ECONNREFUSED|SQL/i.test(e.message), c + ' filtró jerga técnica: ' + e.message);
        }
    });
});
