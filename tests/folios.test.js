// tests/folios.test.js
//
// Pruebas de la regla de numeración del folio.
// No necesitan base de datos.
//
// El folio es el número oficial de matrícula dentro del año lectivo. No corre
// por curso ni por todo el colegio, sino por bloque: 1°-5°, 6°-9° y 10°-11°.
// Dentro de cada bloque la numeración es continua y vuelve a empezar en el
// siguiente. Preescolar no lleva folio.
//
// Esta regla ya se rompió una vez por confundirla con "numerar dentro de cada
// curso", así que queda cubierta aquí.

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { GRADE_BLOCKS, gradeBlock } = require('../src/infrastructure/constants/gradeRanges');

describe('gradeBlock (a qué bloque pertenece un grado)', () => {

    test('primaria: de 1° a 5° es el bloque 1', () => {
        for (let g = 1; g <= 5; g++) {
            assert.strictEqual(gradeBlock(g), 1, `${g}° debería estar en el bloque 1`);
        }
    });

    test('básica: de 6° a 9° es el bloque 2', () => {
        for (let g = 6; g <= 9; g++) {
            assert.strictEqual(gradeBlock(g), 2, `${g}° debería estar en el bloque 2`);
        }
    });

    test('media: 10° y 11° son el bloque 3', () => {
        assert.strictEqual(gradeBlock(10), 3);
        assert.strictEqual(gradeBlock(11), 3);
    });

    test('preescolar queda fuera de todo bloque', () => {
        // Materno, Pre-Jardín, Jardín y Transición no tienen número de grado,
        // así que CAST(name AS UNSIGNED) devuelve 0. No llevan folio.
        assert.strictEqual(gradeBlock(0), 0);
    });

    test('un grado que no existe tampoco cae en ningún bloque', () => {
        assert.strictEqual(gradeBlock(12), 0);
        assert.strictEqual(gradeBlock(-1), 0);
    });

    test('los tres bloques cubren de 1° a 11° sin huecos ni solapes', () => {
        const vistos = new Map();
        for (let g = 1; g <= 11; g++) {
            const b = gradeBlock(g);
            assert.notStrictEqual(b, 0, `${g}° se quedó sin bloque`);
            vistos.set(b, (vistos.get(b) || 0) + 1);
        }
        assert.deepStrictEqual([...vistos.keys()].sort(), [1, 2, 3]);
        assert.strictEqual(vistos.get(1), 5, 'primaria son 5 grados');
        assert.strictEqual(vistos.get(2), 4, 'básica son 4 grados');
        assert.strictEqual(vistos.get(3), 2, 'media son 2 grados');
    });

    test('los rangos declarados no se pisan entre sí', () => {
        const ordenados = [...GRADE_BLOCKS].sort((a, b) => a.min - b.min);
        for (let i = 1; i < ordenados.length; i++) {
            assert.ok(
                ordenados[i].min > ordenados[i - 1].max,
                `el bloque ${ordenados[i].block} empieza antes de que termine el anterior`
            );
        }
    });
});

describe('cómo se ordena antes de numerar', () => {
    // recalculateFolioNumbers ordena por bloque, luego por número de grado,
    // luego por grupo (A antes que B) y por último por apellidos. Aquí se
    // comprueba el criterio de ordenación con la misma forma de los datos.

    const ordenar = (filas) => [...filas].sort((a, b) =>
        gradeBlock(a.grado) - gradeBlock(b.grado)
        || a.grado - b.grado
        || a.grupo.localeCompare(b.grupo)
        || a.apellidos.localeCompare(b.apellidos, 'es')
    );

    test('primero el grado, después el grupo, después el apellido', () => {
        const filas = [
            { grado: 2, grupo: 'A', apellidos: 'Alvarez' },
            { grado: 1, grupo: 'B', apellidos: 'Acosta'  },
            { grado: 1, grupo: 'A', apellidos: 'Zapata'  },
            { grado: 1, grupo: 'A', apellidos: 'Calvache' },
        ];
        assert.deepStrictEqual(
            ordenar(filas).map(f => `${f.grado}${f.grupo} ${f.apellidos}`),
            ['1A Calvache', '1A Zapata', '1B Acosta', '2A Alvarez']
        );
    });

    test('un estudiante de 6° nunca se mezcla con los de 5°', () => {
        const filas = [
            { grado: 6, grupo: 'A', apellidos: 'Aguirre' },
            { grado: 5, grupo: 'B', apellidos: 'Zuñiga'  },
        ];
        const r = ordenar(filas);
        assert.strictEqual(gradeBlock(r[0].grado), 1, 'primero va el bloque de primaria');
        assert.strictEqual(gradeBlock(r[1].grado), 2);
    });

    test('preescolar se ordena por delante de todos y queda sin folio', () => {
        const filas = [
            { grado: 1, grupo: 'A', apellidos: 'Acosta' },
            { grado: 0, grupo: 'A', apellidos: 'Zapata' },
        ];
        const r = ordenar(filas);
        assert.strictEqual(r[0].grado, 0);
        assert.strictEqual(gradeBlock(r[0].grado), 0, 'y al no tener bloque, no recibe folio');
    });
});
