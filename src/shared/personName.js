// src/shared/personName.js
// Punto unico para todo lo relacionado con nombres de personas
// (estudiantes, docentes y administradores).
//
// REGLA DEL PROYECTO: primero APELLIDOS, despues NOMBRES.
// El nombre completo se muestra y se ordena siempre como "Apellidos Nombres".

const { ValidationError } = require('./errors');

const LARGO_MAXIMO = 80;   // debe coincidir con VARCHAR(80) en la base de datos
const LARGO_MINIMO = 2;

// Letras (con tildes y eñe), espacios, apóstrofe, guion y punto.
const CARACTERES_VALIDOS = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]+$/;

// Partículas que en español van en minúscula dentro de un apellido compuesto.
const PARTICULAS = new Set([
    'de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'das', 'do', 'dos', 'van', 'von'
]);

/**
 * Quita espacios sobrantes y normaliza mayúsculas/minúsculas.
 *   "  juan   carlos " -> "Juan Carlos"
 *   "PEREZ DE LA CRUZ" -> "Perez de la Cruz"
 */
function normalizarParteNombre(valor) {
    if (valor === null || valor === undefined) return '';

    const limpio = String(valor).replace(/\s+/g, ' ').trim();
    if (limpio === '') return '';

    return limpio
        .split(' ')
        .map((palabra, indice) => {
            const minuscula = palabra.toLocaleLowerCase('es');
            // Las partículas van en minúscula, salvo que abran el apellido.
            if (indice > 0 && PARTICULAS.has(minuscula)) return minuscula;

            // Se pone mayúscula al principio de la palabra y también después
            // de un guion o un apóstrofe, para que "o'connor" quede "O'Connor"
            // y "saint-martin" quede "Saint-Martin". Con un simple charAt(0)
            // esas letras se quedaban en minúscula.
            return minuscula.replace(
                /(^|[-'])(\p{L})/gu,
                (_, separador, letra) => separador + letra.toLocaleUpperCase('es')
            );
        })
        .join(' ');
}

/**
 * Valida una parte del nombre y devuelve el mensaje de error, o null si está bien.
 */
function revisarParteNombre(valor, etiqueta) {
    if (!valor || valor.trim() === '') {
        return `Los ${etiqueta} son obligatorios`;
    }
    if (valor.length < LARGO_MINIMO) {
        return `Los ${etiqueta} deben tener al menos ${LARGO_MINIMO} caracteres`;
    }
    if (valor.length > LARGO_MAXIMO) {
        return `Los ${etiqueta} no pueden superar ${LARGO_MAXIMO} caracteres`;
    }
    if (/\d/.test(valor)) {
        return `Los ${etiqueta} no pueden contener números`;
    }
    if (!CARACTERES_VALIDOS.test(valor)) {
        return `Los ${etiqueta} contienen caracteres no permitidos`;
    }
    return null;
}

/**
 * Separa un nombre escrito en un solo campo en apellidos y nombres.
 * Usa exactamente la misma regla que la migracion SQL, para que un dato
 * importado por Excel quede igual que uno migrado:
 *
 *   4 palabras o más   -> las 2 últimas son apellidos
 *   3 palabras o menos -> la última es el apellido
 *   1 palabra          -> queda como apellido
 */
function separarNombreCompleto(textoCompleto) {
    const limpio = String(textoCompleto || '').replace(/\s+/g, ' ').trim();
    if (limpio === '') return { nombres: '', apellidos: '' };

    const palabras = limpio.split(' ');
    const cuantosApellidos = palabras.length >= 4 ? 2 : 1;
    const corte = Math.max(palabras.length - cuantosApellidos, 0);

    return {
        nombres: normalizarParteNombre(palabras.slice(0, corte).join(' ')),
        apellidos: normalizarParteNombre(palabras.slice(corte).join(' '))
    };
}

/**
 * Arma el nombre completo en el orden del proyecto: apellidos primero.
 * (En la base de datos lo hace la columna generada; esta función sirve para
 *  respuestas de la API y para armar nombres de archivo de reportes.)
 */
function formatearNombreCompleto(apellidos, nombres) {
    return `${normalizarParteNombre(apellidos)} ${normalizarParteNombre(nombres)}`.trim();
}

/**
 * Lee apellidos y nombres desde el cuerpo de una petición.
 *
 * Acepta varias formas para no romper clientes antiguos:
 *   { lastName, firstName }        <- formato nuevo (el que usa el frontend)
 *   { apellidos, nombres }         <- alias en español
 *   { fullName } o { name }        <- formato viejo, se separa automaticamente
 *
 * Devuelve { apellidos, nombres, fullName } ya normalizado y validado.
 * Lanza ValidationError con el campo exacto si algo esta mal.
 */
function leerNombreDePeticion(cuerpo = {}, { obligatorio = true } = {}) {
    let apellidos = cuerpo.lastName ?? cuerpo.apellidos ?? null;
    let nombres = cuerpo.firstName ?? cuerpo.nombres ?? null;

    const vinoSeparado = apellidos !== null || nombres !== null;

    // Compatibilidad: si solo llegó el nombre en un campo, se separa.
    if (!vinoSeparado) {
        const textoViejo = cuerpo.fullName ?? cuerpo.name ?? '';
        if (String(textoViejo).trim() !== '') {
            const separado = separarNombreCompleto(textoViejo);
            apellidos = separado.apellidos;
            nombres = separado.nombres;
        }
    }

    apellidos = normalizarParteNombre(apellidos);
    nombres = normalizarParteNombre(nombres);

    if (!obligatorio && apellidos === '' && nombres === '') {
        return null;
    }

    const errorApellidos = revisarParteNombre(apellidos, 'apellidos');
    if (errorApellidos) throw new ValidationError(errorApellidos, 'lastName');

    const errorNombres = revisarParteNombre(nombres, 'nombres');
    if (errorNombres) throw new ValidationError(errorNombres, 'firstName');

    return {
        apellidos,
        nombres,
        fullName: formatearNombreCompleto(apellidos, nombres)
    };
}

/**
 * Clave de ordenamiento: sin tildes y con la ñ convertida en n, para ordenar
 * igual que MySQL (collation utf8mb4_0900_ai_ci, que trata ñ = n).
 * Debe coincidir con claveDeOrden() de frontend-react/src/utils/nombres.js.
 */
function claveDeOrden(texto) {
    return String(texto ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim()
        .toLowerCase();
}

/**
 * Comparador para ordenar en memoria por apellidos y luego nombres.
 */
function compararPorApellidos(a, b) {
    const apA = claveDeOrden(a?.last_name ?? a?.apellidos);
    const apB = claveDeOrden(b?.last_name ?? b?.apellidos);
    const porApellido = apA.localeCompare(apB, 'es');
    if (porApellido !== 0) return porApellido;

    return claveDeOrden(a?.first_name ?? a?.nombres)
        .localeCompare(claveDeOrden(b?.first_name ?? b?.nombres), 'es');
}

module.exports = {
    LARGO_MAXIMO,
    LARGO_MINIMO,
    normalizarParteNombre,
    revisarParteNombre,
    separarNombreCompleto,
    formatearNombreCompleto,
    leerNombreDePeticion,
    compararPorApellidos
};
