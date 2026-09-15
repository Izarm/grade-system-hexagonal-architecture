// src/shared/ordenGrados.js
//
// ORDEN DE LOS GRADOS
//
// Los grados se llaman "Materno", "Pre-Jardín", "Jardín", "Transición",
// "1°", "2°" ... "11°".
//
// El problema de ordenar con CAST(g.name AS UNSIGNED) es que los cuatro
// nombres de preescolar valen 0, asi que quedan empatados entre si y salen
// en cualquier orden. Antes se intentaba desempatar con RIGHT(g.name, 1),
// que devuelve 'n' para Jardin, Pre-Jardin y Transicion: seguian empatados.
//
// Esta expresion da el orden real del colegio:
//   Materno(0) · Pre-Jardín(1) · Jardín(2) · Transición(3) · 1°(11) ... 11°(21)

const ORDEN_GRADO_SQL = `
    CASE
        WHEN :col LIKE 'Materno%'     THEN 0
        WHEN :col LIKE 'Pre-Jard%'    THEN 1
        WHEN :col LIKE 'Jard%'        THEN 2
        WHEN :col LIKE 'Transici%'    THEN 3
        ELSE 10 + CAST(:col AS UNSIGNED)
    END`;

/**
 * Devuelve la expresión SQL de ordenamiento para una columna de nombre de grado.
 *
 *   ordenGrado('g.name')  ->  "CASE WHEN g.name LIKE 'Materno%' THEN 0 ... END"
 *
 * Se usa dentro de un ORDER BY:
 *   ORDER BY ${ordenGrado('g.name')}, grp.name, e.folio_number
 *
 * Nota: no recibe datos del usuario, solo nombres de columna escritos en el
 * código, así que no hay riesgo de inyección.
 */
function ordenGrado(columna) {
    return ORDEN_GRADO_SQL.split(':col').join(columna);
}

module.exports = { ordenGrado };
