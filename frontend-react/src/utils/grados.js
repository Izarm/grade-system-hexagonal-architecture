// frontend-react/src/utils/grados.js
//
// ORDEN DE LOS GRADOS
//
// Debe coincidir con src/shared/ordenGrados.js del backend, para que la lista
// no se reacomode al llegar al navegador.
//
// El problema de usar parseInt(nombre) es que "Materno", "Pre-Jardín",
// "Jardín" y "Transición" no tienen número: todos quedaban en 0 o en 999 y
// empataban entre sí, saliendo en cualquier orden.

/**
 * Peso numérico de un grado, para ordenar.
 *   Materno 0 · Pre-Jardín 1 · Jardín 2 · Transición 3 · 1° 11 ... 11° 21
 */
export function pesoDeGrado(nombreGrado) {
  const n = String(nombreGrado ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim().toLowerCase();

  if (n.startsWith('materno')) return 0;
  if (n.startsWith('pre-jard') || n.startsWith('prejard')) return 1;
  if (n.startsWith('jard')) return 2;
  if (n.startsWith('transici')) return 3;

  const numero = parseInt(n, 10);
  return Number.isNaN(numero) ? 999 : 10 + numero;
}

/**
 * Letra del curso dentro del grado ("11° A" -> "A"). Vacío si no tiene.
 */
export function letraDeCurso(nombre) {
  const m = String(nombre ?? '').trim().match(/([A-Za-z])\s*$/);
  return m ? m[1].toUpperCase() : '';
}

/**
 * Comparador de grados por nombre: Materno -> 11°, y luego por letra de curso.
 * Sirve para listas como ["11° A", "1° B", "Jardín A"].
 */
export function compararGrados(a, b) {
  const nombreA = typeof a === 'string' ? a : (a?.name ?? a?.grade_name ?? a?.displayName ?? '');
  const nombreB = typeof b === 'string' ? b : (b?.name ?? b?.grade_name ?? b?.displayName ?? '');

  const pesoA = pesoDeGrado(nombreA);
  const pesoB = pesoDeGrado(nombreB);
  if (pesoA !== pesoB) return pesoA - pesoB;

  return letraDeCurso(nombreA).localeCompare(letraDeCurso(nombreB), 'es');
}

/**
 * Ordena una lista de grados o cursos (sin modificar la original).
 */
export function ordenarGrados(lista) {
  return [...(lista || [])].sort(compararGrados);
}
