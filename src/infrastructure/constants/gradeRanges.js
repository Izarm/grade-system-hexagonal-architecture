// Bloques de numeración del folio.
//
// El folio no corre por curso ni por todo el colegio, sino por bloque: dentro
// de cada uno la numeración es continua y vuelve a empezar en el siguiente.
// Preescolar (Materno, Pre-Jardín, Jardín, Transición) no lleva folio; como no
// tiene número de grado, cae en el bloque 0.
//
// Quien aplica la regla es recalculateFolioNumbers(), en EnrollmentRepository
// y en GradeRepository. Cubierto por tests/folios.test.js.

const GRADE_BLOCKS = [
    { block: 1, min: 1,  max: 5,  nombre: 'Primaria' },
    { block: 2, min: 6,  max: 9,  nombre: 'Básica'   },
    { block: 3, min: 10, max: 11, nombre: 'Media'    },
];

function gradeBlock(gradeNum) {
    for (const b of GRADE_BLOCKS) {
        if (gradeNum >= b.min && gradeNum <= b.max) return b.block;
    }
    return 0;
}

module.exports = { GRADE_BLOCKS, gradeBlock };
