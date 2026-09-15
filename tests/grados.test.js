// tests/grados.test.js
//
// Pruebas del orden de los grados.
// No necesitan base de datos.

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { ordenGrado } = require('../src/shared/ordenGrados');

describe('ordenGrado (expresión SQL)', () => {
    test('reemplaza el nombre de la columna en todas las apariciones', () => {
        const sql = ordenGrado('g.name');
        assert.ok(!sql.includes(':col'), 'quedaron marcadores sin reemplazar');
        assert.ok(sql.includes('g.name'));
    });

    test('cubre los cuatro grados de preescolar', () => {
        const sql = ordenGrado('g.name');
        for (const nombre of ['Materno', 'Pre-Jard', 'Jard', 'Transici']) {
            assert.ok(sql.includes(nombre), 'falta ' + nombre);
        }
    });
});
