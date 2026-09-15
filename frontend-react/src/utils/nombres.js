// frontend-react/src/utils/nombres.js
//
// Regla del proyecto: primero APELLIDOS, despues NOMBRES.
// Todo lo que muestre u ordene personas (estudiantes, docentes, admins)
// debe pasar por aqui, para que listas, notas y reportes coincidan.

export const LARGO_MAXIMO_NOMBRE = 80;
export const LARGO_MINIMO_NOMBRE = 2;

const CARACTERES_VALIDOS = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]+$/;

/**
 * Nombre completo en el orden del proyecto.
 * Funciona con cualquiera de las formas que devuelve la API:
 *   { last_name, first_name }  |  { full_name }  |  { name }
 */
export function nombreCompleto(persona) {
  if (!persona) return '';

  const apellidos = apellidosDe(persona);
  const nombres = nombresDe(persona);

  if (apellidos || nombres) return `${apellidos} ${nombres}`.trim();

  // Respaldo para respuestas que solo traen el campo calculado.
  return (persona.full_name ?? persona.fullName ?? persona.name ?? '').trim();
}

// La API puede responder en snake_case (last_name) o en camelCase (lastName),
// segun pase o no por el middleware camelCaseResponse. Se aceptan las dos.
export function apellidosDe(persona) {
  return String(persona?.last_name ?? persona?.lastName ?? '').trim();
}

export function nombresDe(persona) {
  return String(persona?.first_name ?? persona?.firstName ?? '').trim();
}

/**
 * Solo los apellidos (para tablas con columnas separadas).
 */
export function soloApellidos(persona) {
  if (!persona) return '';
  const ap = apellidosDe(persona);
  if (ap) return ap;
  const completo = (persona.full_name ?? persona.name ?? '').trim();
  return completo.split(' ').slice(0, 2).join(' ');
}

/**
 * Solo los nombres.
 */
export function soloNombres(persona) {
  if (!persona) return '';
  const nom = nombresDe(persona);
  if (nom) return nom;
  const completo = (persona.full_name ?? persona.name ?? '').trim();
  return completo.split(' ').slice(2).join(' ');
}

/**
 * Clave de ordenamiento.
 *
 * IMPORTANTE: quita tildes y convierte la ñ en n a proposito, para que el
 * navegador ordene EXACTAMENTE igual que MySQL (collation utf8mb4_0900_ai_ci),
 * que trata ñ = n. Si no se hiciera, una lista ya ordenada por la base se
 * reacomodaria sola al llegar al navegador: MySQL pone "Cañon" antes de
 * "Cantillo" y localeCompare('es') lo pone despues.
 *
 * Si algun dia se prefiere el orden del alfabeto español (ñ despues de la n),
 * hay que cambiarlo en los dos lados a la vez: aqui y en el ORDER BY del
 * backend (añadiendo COLLATE utf8mb4_es_0900_ai_ci).
 */
function claveDeOrden(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Comparador para ordenar listas: apellidos y luego nombres.
 */
export function compararPorApellidos(a, b) {
  const apA = claveDeOrden(apellidosDe(a));
  const apB = claveDeOrden(apellidosDe(b));

  // Si la API no mandó los campos separados, se usa el nombre completo,
  // que ya viene en orden "apellidos nombres".
  if (!apA && !apB) {
    return claveDeOrden(nombreCompleto(a)).localeCompare(claveDeOrden(nombreCompleto(b)), 'es');
  }

  const porApellido = apA.localeCompare(apB, 'es');
  if (porApellido !== 0) return porApellido;

  return claveDeOrden(nombresDe(a)).localeCompare(claveDeOrden(nombresDe(b)), 'es');
}

/**
 * Ordena una lista de personas por apellidos (sin modificar la original).
 */
export function ordenarPorApellidos(lista) {
  return [...(lista || [])].sort(compararPorApellidos);
}

/**
 * Quita tildes y pasa a minuscula, para buscar sin preocuparse por acentos.
 */
export function normalizarBusqueda(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Busca el texto en apellidos, nombres y nombre completo a la vez,
 * asi da igual si el usuario escribe "perez juan" o "juan perez".
 */
export function coincideBusqueda(persona, busqueda) {
  const aguja = normalizarBusqueda(busqueda).trim();
  if (aguja === '') return true;

  const apellidos = normalizarBusqueda(apellidosDe(persona));
  const nombres = normalizarBusqueda(nombresDe(persona));
  const completo = normalizarBusqueda(nombreCompleto(persona));
  const invertido = `${nombres} ${apellidos}`.trim();
  const codigo = normalizarBusqueda(
    persona?.student_code ?? persona?.studentCode ?? persona?.document ?? persona?.documentNumber
  );

  // Cada palabra buscada debe aparecer en alguna parte.
  return aguja.split(/\s+/).every(parte =>
    completo.includes(parte) ||
    invertido.includes(parte) ||
    codigo.includes(parte)
  );
}

/**
 * Valida una parte del nombre. Devuelve el mensaje de error o null.
 * Los mensajes son los mismos que usa el backend.
 */
export function validarParteNombre(valor, etiqueta) {
  const limpio = String(valor ?? '').trim();

  if (limpio === '') return `Los ${etiqueta} son obligatorios`;
  if (limpio.length < LARGO_MINIMO_NOMBRE) {
    return `Los ${etiqueta} deben tener al menos ${LARGO_MINIMO_NOMBRE} caracteres`;
  }
  if (limpio.length > LARGO_MAXIMO_NOMBRE) {
    return `Los ${etiqueta} no pueden superar ${LARGO_MAXIMO_NOMBRE} caracteres`;
  }
  if (/\d/.test(limpio)) return `Los ${etiqueta} no pueden contener números`;
  if (!CARACTERES_VALIDOS.test(limpio)) return `Los ${etiqueta} contienen caracteres no permitidos`;

  return null;
}

/**
 * Valida apellidos y nombres juntos.
 * Devuelve un objeto { lastName?, firstName? } con los errores encontrados.
 */
export function validarNombre({ lastName, firstName }) {
  const errores = {};

  const errorApellidos = validarParteNombre(lastName, 'apellidos');
  if (errorApellidos) errores.lastName = errorApellidos;

  const errorNombres = validarParteNombre(firstName, 'nombres');
  if (errorNombres) errores.firstName = errorNombres;

  return errores;
}
