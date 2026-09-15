// src/shared/folio.js
//
// NUMERO DE FOLIO (numero de lista)
//
// Regla: dentro de cada CURSO (grupo), los estudiantes se numeran 1, 2, 3...
// en orden alfabetico por APELLIDOS y luego nombres.
//
// Por que por curso y no por grado o por seccion:
//   - La lista que ve el docente para registrar notas esta filtrada por grupo
//     (report.controller: "WHERE e.group_id = ?"), asi que el folio tiene que
//     ser el numero de lista de ese curso.
//   - Los informes por grado ordenan por grupo y despues por folio, de modo que
//     sale primero todo el curso A y luego todo el B, cada uno numerado desde 1.
//
// Antes esto se calculaba por "bloques" (1-5, 6-9, 10-11) con un contador que
// no se reiniciaba por grado, y ademas todo preescolar caia en el mismo bloque
// porque CAST('Jardín' AS UNSIGNED) vale 0 igual que CAST('Materno' AS UNSIGNED).
// El resultado era que Jardin, Transicion y Pre-Jardin quedaban mezclados entre
// si, y que 5° empezaba en el folio 150 en vez de en el 1.

const pool = require('../infrastructure/database/mysql');

/**
 * Renumera los folios de un año lectivo.
 *
 * @param {number} academicYearId  año lectivo a renumerar
 * @param {object} conexion        conexión o transacción; si no se pasa, usa el pool
 * @returns {Promise<number>}      cuántas matrículas quedaron numeradas
 */
async function recalcularFolios(academicYearId, conexion = null) {
    const db = conexion || pool;

    // Una sola sentencia: ROW_NUMBER() numera desde 1 dentro de cada grupo.
    // `s.id` al final solo desempata si dos estudiantes se llaman exactamente igual,
    // para que el resultado sea siempre el mismo si se vuelve a ejecutar.
    const [resultado] = await db.query(
        `UPDATE enrollments e
           JOIN (
                SELECT e2.id,
                       ROW_NUMBER() OVER (
                           PARTITION BY e2.group_id
                           ORDER BY s.last_name, s.first_name, s.id
                       ) AS numero
                  FROM enrollments e2
                  JOIN students s ON e2.student_id = s.id
                 WHERE e2.academic_year_id = ?
                   AND e2.deleted_at IS NULL
                   AND s.deleted_at IS NULL
           ) AS calculado ON calculado.id = e.id
            SET e.folio_number = calculado.numero`,
        [academicYearId]
    );

    return resultado.affectedRows;
}

/**
 * Cuántas matrículas hay en un año lectivo (para informar, no modifica nada).
 */
async function contarMatriculas(academicYearId, conexion = null) {
    const db = conexion || pool;
    const [[fila]] = await db.query(
        `SELECT COUNT(*) AS total
           FROM enrollments e
           JOIN students s ON e.student_id = s.id
          WHERE e.academic_year_id = ? AND e.deleted_at IS NULL AND s.deleted_at IS NULL`,
        [academicYearId]
    );
    return fila.total;
}

module.exports = { recalcularFolios, contarMatriculas };
