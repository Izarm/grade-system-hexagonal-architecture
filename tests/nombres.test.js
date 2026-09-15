// tests/nombres.test.js
//
// Pruebas de la lógica de nombres y apellidos.
// No necesitan base de datos: se ejecutan en segundos.
//
//   npm test

const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
    normalizarParteNombre,
    separarNombreCompleto,
    formatearNombreCompleto,
    leerNombreDePeticion,
    compararPorApellidos
} = require('../src/shared/personName');

describe('normalizarParteNombre', () => {
    test('quita espacios sobrantes', () => {
        assert.strictEqual(normalizarParteNombre('  juan   carlos '), 'Juan Carlos');
    });

    test('arregla mayúsculas desordenadas', () => {
        assert.strictEqual(normalizarParteNombre('AGREDO figueroa'), 'Agredo Figueroa');
    });

    test('deja las partículas en minúscula', () => {
        assert.strictEqual(normalizarParteNombre('PEREZ DE LA CRUZ'), 'Perez de la Cruz');
    });

    test('la partícula inicial sí lleva mayúscula', () => {
        assert.strictEqual(normalizarParteNombre('de la cruz'), 'De la Cruz');
    });

    test('respeta la mayúscula tras un apóstrofe', () => {
        assert.strictEqual(normalizarParteNombre("o'connor"), "O'Connor");
    });

    test('respeta la mayúscula tras un guion', () => {
        assert.strictEqual(normalizarParteNombre('saint-martin'), 'Saint-Martin');
    });

    test('conserva tildes y eñes', () => {
        assert.strictEqual(normalizarParteNombre('ÑAÑEZ MUÑOZ'), 'Ñañez Muñoz');
    });

    test('un valor vacío no revienta', () => {
        assert.strictEqual(normalizarParteNombre(null), '');
        assert.strictEqual(normalizarParteNombre(undefined), '');
        assert.strictEqual(normalizarParteNombre('   '), '');
    });
});

describe('separarNombreCompleto', () => {
    test('dos palabras: la última es el apellido', () => {
        assert.deepStrictEqual(separarNombreCompleto('Juan Perez'),
            { nombres: 'Juan', apellidos: 'Perez' });
    });

    test('cuatro palabras: las dos últimas son apellidos', () => {
        assert.deepStrictEqual(separarNombreCompleto('Ana Maria Gomez Ruiz'),
            { nombres: 'Ana Maria', apellidos: 'Gomez Ruiz' });
    });

    test('tres palabras: solo un apellido', () => {
        assert.deepStrictEqual(separarNombreCompleto('Ana Maria Gomez'),
            { nombres: 'Ana Maria', apellidos: 'Gomez' });
    });

    test('una palabra: queda como apellido, para que ordene', () => {
        assert.deepStrictEqual(separarNombreCompleto('Alejo'),
            { nombres: '', apellidos: 'Alejo' });
    });
});

describe('formatearNombreCompleto', () => {
    test('apellidos primero', () => {
        assert.strictEqual(formatearNombreCompleto('Pérez Gómez', 'Juan Carlos'),
            'Pérez Gómez Juan Carlos');
    });

    test('sin nombres no deja espacio al final', () => {
        assert.strictEqual(formatearNombreCompleto('Pérez', ''), 'Pérez');
    });
});

describe('leerNombreDePeticion', () => {
    test('acepta el formato nuevo', () => {
        const r = leerNombreDePeticion({ lastName: 'Pérez Gómez', firstName: 'Juan Carlos' });
        assert.strictEqual(r.apellidos, 'Pérez Gómez');
        assert.strictEqual(r.nombres, 'Juan Carlos');
        assert.strictEqual(r.fullName, 'Pérez Gómez Juan Carlos');
    });

    test('acepta alias en español', () => {
        const r = leerNombreDePeticion({ apellidos: 'Pérez', nombres: 'Juan' });
        assert.strictEqual(r.fullName, 'Pérez Juan');
    });

    test('acepta el formato antiguo de un solo campo', () => {
        const r = leerNombreDePeticion({ fullName: 'Juan Carlos Pérez Gómez' });
        assert.strictEqual(r.apellidos, 'Pérez Gómez');
        assert.strictEqual(r.nombres, 'Juan Carlos');
    });

    test('rechaza apellidos vacíos indicando el campo', () => {
        assert.throws(
            () => leerNombreDePeticion({ lastName: '', firstName: 'Juan' }),
            e => e.field === 'lastName' && /apellidos son obligatorios/.test(e.message)
        );
    });

    test('rechaza nombres vacíos indicando el campo', () => {
        assert.throws(
            () => leerNombreDePeticion({ lastName: 'Pérez', firstName: '' }),
            e => e.field === 'firstName'
        );
    });

    test('rechaza números', () => {
        assert.throws(
            () => leerNombreDePeticion({ lastName: 'Perez3', firstName: 'Juan' }),
            e => /no pueden contener números/.test(e.message)
        );
    });

    test('rechaza nombres demasiado largos', () => {
        assert.throws(
            () => leerNombreDePeticion({ lastName: 'A'.repeat(81), firstName: 'Juan' }),
            e => /no pueden superar 80/.test(e.message)
        );
    });

    test('rechaza caracteres extraños', () => {
        assert.throws(
            () => leerNombreDePeticion({ lastName: 'Perez <script>', firstName: 'Juan' }),
            e => e.field === 'lastName'
        );
    });
});

describe('compararPorApellidos', () => {
    test('ordena por apellido y desempata por nombre', () => {
        const lista = [
            { last_name: 'Torres', first_name: 'Ana' },
            { last_name: 'Agredo', first_name: 'Zoe' },
            { last_name: 'Agredo', first_name: 'Ana' }
        ].sort(compararPorApellidos);

        assert.deepStrictEqual(
            lista.map(p => `${p.last_name} ${p.first_name}`),
            ['Agredo Ana', 'Agredo Zoe', 'Torres Ana']
        );
    });

    test('la ñ se ordena como n, igual que MySQL', () => {
        const lista = [
            { last_name: 'Cantillo', first_name: 'A' },
            { last_name: 'Cañon', first_name: 'B' },
            { last_name: 'Canas', first_name: 'C' }
        ].sort(compararPorApellidos);

        assert.deepStrictEqual(lista.map(p => p.last_name), ['Canas', 'Cañon', 'Cantillo']);
    });

    test('las tildes no alteran el orden', () => {
        const lista = [
            { last_name: 'Agredo Figueroa', first_name: 'A' },
            { last_name: 'Ágredo Carvajal', first_name: 'B' },
            { last_name: 'Agredo Berrio', first_name: 'C' }
        ].sort(compararPorApellidos);

        assert.deepStrictEqual(
            lista.map(p => p.last_name),
            ['Agredo Berrio', 'Ágredo Carvajal', 'Agredo Figueroa']
        );
    });
});
