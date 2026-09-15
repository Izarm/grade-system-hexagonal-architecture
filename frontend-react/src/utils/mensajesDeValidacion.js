// Mensajes de validación de formularios en español.
//
// Cuando un campo no pasa la validación del navegador (un correo mal escrito,
// un obligatorio vacío), Chrome muestra un globo con su propio texto — y ese
// texto va en el idioma del navegador, no en el de la página. En un Chrome en
// inglés sale "'.' is used at a wrong position in '.com'", que no le dice nada
// a quien está matriculando estudiantes.
//
// Aquí se reemplaza por un mensaje propio. Se engancha una sola vez sobre el
// documento en lugar de campo por campo: el evento 'invalid' no burbujea, así
// que se escucha en fase de captura, y de esa forma quedan cubiertos todos los
// formularios de la aplicación, también los que se agreguen después.

// El nombre visible del campo, para poder decir cuál falta. `labels` solo trae
// algo cuando el <label> lleva `for` o envuelve al campo; en estos formularios
// es un hermano dentro del mismo <div>, así que se busca también ahí.
const nombreDelCampo = (campo) => {
    const etiqueta = campo.labels?.[0] || campo.closest('div')?.querySelector('label');
    return etiqueta?.textContent.replace(/\s*\*\s*$/, '').trim() || '';
};

const textoDelError = (campo) => {
    const v = campo.validity;
    const etiqueta = nombreDelCampo(campo);

    if (v.valueMissing) {
        return etiqueta ? `Completa el campo "${etiqueta}"` : 'Completa este campo';
    }
    if (v.typeMismatch) {
        if (campo.type === 'email') return 'Escribe un correo válido, por ejemplo nombre@gmail.com';
        if (campo.type === 'url') return 'Escribe una dirección web válida, por ejemplo https://ejemplo.com';
        return 'El formato no es válido';
    }
    if (v.tooShort)  return `Escribe al menos ${campo.minLength} caracteres`;
    if (v.tooLong)   return `No puede tener más de ${campo.maxLength} caracteres`;
    if (v.rangeUnderflow) return `El valor mínimo es ${campo.min}`;
    if (v.rangeOverflow)  return `El valor máximo es ${campo.max}`;
    if (v.stepMismatch)   return 'El valor no es válido';
    if (v.badInput)       return 'Lo escrito no se entiende; revísalo';
    if (v.patternMismatch) return 'El formato no es válido';
    return 'Revisa este campo';
};

export const activarMensajesEnEspanol = () => {
    // 'invalid' no burbujea: hay que escucharlo en captura para enterarse.
    document.addEventListener('invalid', (e) => {
        const campo = e.target;
        if (!(campo instanceof HTMLElement) || typeof campo.setCustomValidity !== 'function') return;
        campo.setCustomValidity('');
        if (campo.validity.valid) return;
        campo.setCustomValidity(textoDelError(campo));
    }, true);

    // Al escribir se borra el mensaje anterior; si no, el campo se quedaría
    // marcado como inválido para siempre aunque se corrija.
    document.addEventListener('input', (e) => {
        const campo = e.target;
        if (typeof campo?.setCustomValidity === 'function') campo.setCustomValidity('');
    }, true);
};
