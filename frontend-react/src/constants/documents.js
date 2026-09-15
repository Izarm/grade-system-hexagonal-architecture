// Documentos que el colegio lleva por estudiante (checklist tiene / no tiene).
export const STUDENT_DOCS = [
    { code: 'pagare',      label: 'Pagaré' },
    { code: 'contrato',    label: 'Contrato' },
    { code: 'eps',         label: 'EPS' },
    { code: 'audiometria', label: 'Audiometría' },
    { code: 'visiometria', label: 'Visiometría' },
];

export const DOC_LABEL = Object.fromEntries(STUDENT_DOCS.map(d => [d.code, d.label]));
