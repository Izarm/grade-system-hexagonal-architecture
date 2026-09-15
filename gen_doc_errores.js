const { Document, Packer, Paragraph, TextRun, AlignmentType,
        Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType } = require('docx');
const fs = require('fs');

const BLUE = '1D4ED8';
const GRAY = '555555';
const RED = 'B91C1C';
const GREEN = '15803D';
const FONT = 'Georgia';

const run = (text, o = {}) => new TextRun({ text, font: FONT, size: o.size || 22, bold: o.bold, italics: o.italics, color: o.color });
const code = (text) => new TextRun({ text, font: 'Consolas', size: 20, color: RED });

const P = (children, opts = {}) => new Paragraph({
    alignment: opts.align || AlignmentType.JUSTIFIED,
    spacing: { after: opts.after ?? 100, before: opts.before ?? 0, line: 276 },
    children: Array.isArray(children) ? children : [run(children, opts)]
});

const H1 = (text) => new Paragraph({
    spacing: { before: 240, after: 80 },
    border: { bottom: { color: 'CBD5E1', space: 4, style: BorderStyle.SINGLE, size: 6 } },
    children: [new TextRun({ text, font: FONT, size: 28, color: BLUE })]
});

// Ficha de error: título + Síntoma / Causa / Solución
const ERR = (num, area, title, sintoma, causa, solucion) => {
    const out = [];
    out.push(new Paragraph({
        spacing: { before: 200, after: 40 },
        keepNext: true,
        children: [
            new TextRun({ text: `${num}. `, font: FONT, size: 23, bold: true, color: BLUE }),
            new TextRun({ text: title, font: FONT, size: 23, bold: true, color: '1A1A1A' }),
        ]
    }));
    out.push(new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: area, font: FONT, size: 18, italics: true, color: GRAY })]
    }));
    const field = (label, color, children) => new Paragraph({
        alignment: AlignmentType.JUSTIFIED, spacing: { after: 50, line: 264 },
        children: [new TextRun({ text: label + '  ', font: FONT, size: 20, bold: true, color }),
                   ...(Array.isArray(children) ? children : [run(children, { size: 21 })])]
    });
    out.push(field('Síntoma:', '1A1A1A', sintoma));
    out.push(field('Causa:', RED, causa));
    out.push(field('Solución:', GREEN, solucion));
    return out;
};

const border = { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' };
const BORDERS = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
const cellTxt = (text, { bold, header, align } = {}) => new TableCell({
    margins: { top: 40, bottom: 40, left: 90, right: 90 },
    shading: header ? { type: ShadingType.SOLID, color: BLUE, fill: BLUE } : undefined,
    children: [new Paragraph({ alignment: align || AlignmentType.LEFT,
        children: [new TextRun({ text: String(text), font: FONT, size: 19, bold, color: header ? 'FFFFFF' : '1A1A1A' })] })]
});
const T = (rows, widths) => new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: widths, borders: BORDERS,
    rows: rows.map((r, ri) => new TableRow({ children: r.map(c => cellTxt(c, { header: ri === 0, bold: ri === 0 })) }))
});

const children = [];

// PORTADA
children.push(new Paragraph({ spacing: { before: 2600 }, children: [] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
    children: [new TextRun({ text: 'COLEGIO SAN JOSÉ DE TARBES', font: FONT, size: 26, color: GRAY, allCaps: true })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [new TextRun({ text: 'Errores Corregidos', font: FONT, size: 52, color: BLUE })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
    children: [new TextRun({ text: 'Registro de correcciones del sistema', font: FONT, size: 28, italics: true, color: '444444' })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: 'Sistema de Gestión de Notas', font: FONT, size: 22, color: '666666' })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Anexo a la documentación final', font: FONT, size: 22, color: '666666' })] }));
children.push(new Paragraph({ pageBreakBefore: true, children: [] }));

// INTRO
children.push(H1('Introducción'));
children.push(P('Este documento recopila los errores detectados y corregidos durante el desarrollo, la migración y la puesta a punto del Sistema de Gestión de Notas del Colegio San José de Tarbes. Cada corrección se describe con tres elementos: el síntoma (lo que se observaba), la causa (el origen técnico del problema) y la solución aplicada. El objetivo es dejar constancia del proceso de depuración y facilitar el mantenimiento futuro.'));

// TABLA RESUMEN
children.push(H1('Resumen de correcciones'));
children.push(T([
    ['#', 'Área', 'Corrección'],
    ['1', 'Migración', 'Nombres vacíos en matrículas históricas'],
    ['2', 'Migración', 'Contraseñas no válidas por prefijo de cifrado'],
    ['3', 'Matrículas', 'Folios desordenados y secciones mezcladas'],
    ['4', 'Matrículas', 'Folio 1 asignado al grupo equivocado'],
    ['5', 'Año lectivo', 'El sistema mostraba "No hay grados" tras reiniciar'],
    ['6', 'Períodos', 'Períodos cerrados automáticamente'],
    ['7', 'Inicio', 'Tarjeta "Grados" contaba niveles y no grupos'],
    ['8', 'Inicio', 'Gráfica de rendimiento mezclaba secciones A y B'],
    ['9', 'Preescolar', 'Niveles de solo matrícula seguían apareciendo'],
    ['10', 'Estudiantes', 'Generación automática de código rota'],
    ['11', 'Interfaz', 'Emojis en distintas pantallas'],
    ['12', 'Datos', 'Nombres sin formato uniforme'],
], [600, 2200, 6200]));

// DETALLE
children.push(H1('Detalle de las correcciones'));

children.push(...ERR('1', 'Migración e integración de datos',
    'Nombres vacíos en las matrículas históricas',
    'Al migrar las matrículas históricas (2011–2024), los registros quedaban sin el nombre del estudiante.',
    [run('El script de migración leía las columnas '), code('nombres'), run(' y '), code('apellidos'), run(', pero la base de datos de origen tenía los campos en singular: '), code('nombre'), run(' y '), code('apellido'), run('.')],
    [run('Se corrigió el script '), code('migrate_history.js'), run(' para leer '), code('CONCAT(nombre, " ", apellido)'), run(', migrando correctamente los 2.128 registros históricos.')]));

children.push(...ERR('2', 'Migración e integración de datos',
    'Contraseñas no válidas tras la migración',
    'Algunos usuarios migrados no podían iniciar sesión aunque la contraseña fuera correcta.',
    [run('El sistema anterior (Laravel/PHP) cifraba las contraseñas con el prefijo '), code('$2y$'), run(', mientras que Node.js espera el prefijo '), code('$2b$'), run(' (mismo algoritmo bcrypt, distinto identificador).')],
    [run('La migración convierte el prefijo '), code('$2y$'), run(' a '), code('$2b$'), run(' conservando el hash. Se detectó además un usuario que quedó sin convertir, señalado para corrección puntual.')]));

children.push(...ERR('3', 'Matrículas — números de folio',
    'Folios desordenados y secciones A y B mezcladas',
    'Los números de folio aparecían desordenados y algunos repetidos; las secciones A y B de un mismo grado se intercalaban.',
    [run('La consulta ordenaba por '), code('RIGHT(g.name, 1)'), run(', que en los grados numerados devuelve siempre el símbolo "°", por lo que todas las secciones se ordenaban igual y quedaban mezcladas alfabéticamente.')],
    [run('Se cambió el ordenamiento a '), code("FIELD(grp.name,'A','B',...)"), run(' seguido del nombre, de modo que cada grado agrupa primero su sección A y luego la B, con folios consecutivos por bloque.')]));

children.push(...ERR('4', 'Matrículas — números de folio',
    'El folio número 1 pertenecía al grupo equivocado',
    'El folio 1 aparecía asignado a un estudiante de 1°B en lugar de 1°A.',
    'Era consecuencia del mismo ordenamiento defectuoso del punto anterior: al mezclar secciones, el primer folio caía en la sección incorrecta.',
    [run('Con el nuevo ordenamiento por sección, 1°A recibe los folios 1 en adelante y 1°B los siguientes. Se ejecutó el recálculo de folios por bloques de grados.')]));

children.push(...ERR('5', 'Año lectivo',
    'El sistema mostraba "No hay grados" tras reiniciar',
    'Al reiniciar el servidor, la aplicación indicaba que no había grados ni año lectivo activo.',
    [run('Un proceso automático de cierre ('), code('checkAndCloseYear'), run(') que se ejecuta al arrancar cerraba el año lectivo porque su fecha de finalización ('), code('end_date'), run(') ya había pasado.')],
    [run('Se ajustó la fecha de finalización del año lectivo activo a una fecha vigente ('), code('2026-12-31'), run('), evitando el cierre automático indebido.')]));

children.push(...ERR('6', 'Períodos académicos',
    'Los períodos se cerraban solos',
    'Los cuatro períodos académicos aparecían cerrados sin intervención del usuario, impidiendo registrar notas.',
    'El mismo proceso automático de cierre por fecha marcaba los períodos como cerrados al arrancar el servidor.',
    [run('Se reabrieron los períodos ('), code("status='open'"), run(') y se corrigieron las fechas para que el cierre automático no los afecte antes de tiempo.')]));

children.push(...ERR('7', 'Panel de inicio',
    'La tarjeta "Grados" mostraba un número incorrecto',
    'El inicio mostraba "15" en la tarjeta de Grados, aunque el subtítulo decía "Grupos activos".',
    [run('La consulta contaba los registros de la tabla '), code('grades'), run(' (los niveles: 1°, 2°…), no los grupos con matrícula activa.')],
    [run('Se cambió el conteo para contar los '), run('grupos activos', { bold: true }), run(' con matrícula en el año en curso (1°A, 1°B, 2°A…), coherente con el subtítulo.')]));

children.push(...ERR('8', 'Panel de inicio',
    'La gráfica de rendimiento mezclaba las secciones A y B',
    'En "Rendimiento por grado" cada grado mostraba una sola barra, uniendo los promedios de 1°A y 1°B en uno solo.',
    [run('La consulta agrupaba por '), code('grades.id'), run(' (el nivel), fusionando todas las secciones de un mismo grado.')],
    [run('Se cambió la agrupación por '), code('groups.id'), run(', mostrando "1° A", "1° B", etc. como barras independientes con su propio promedio.')]));

children.push(...ERR('9', 'Grados de solo matrícula (preescolar)',
    'Los niveles de preescolar seguían apareciendo donde no debían',
    'Tras marcar Materno, Pre-Jardín, Jardín y Transición como "solo matrícula", aún aparecían en el módulo de Asignaciones.',
    [run('El controlador de grupos reconstruía cada grupo en un objeto nuevo y '), run('descartaba la bandera ', { bold: true }), code('takes_grades'), run(', por lo que el filtro del frontend nunca la recibía y no filtraba nada.')],
    [run('Se incluyó '), code('takes_grades'), run(' en la respuesta del controlador ('), code('list'), run(' y '), code('listByGrade'), run('). Con el dato disponible, preescolar desaparece de Asignaciones, Registro de Notas y Reportes de notas.')]));

children.push(...ERR('10', 'Estudiantes — código automático',
    'La generación automática de código no continuaba la secuencia',
    'Al crear un estudiante nuevo, el código propuesto reiniciaba en "2026-001" en vez de continuar desde el último existente (2026079).',
    [run('La función generaba el código con guion ('), code('2026-001'), run(') y buscaba con '), code("LIKE '2026-%'"), run('; como los códigos reales no llevan guion ('), code('2026079'), run('), no encontraba ninguno y devolvía siempre el primero.')],
    [run('Se reescribió la generación para usar el mismo formato sin guion ('), code('AÑO+secuencia'), run(') y tomar el '), run('máximo consecutivo real', { bold: true }), run(' del año con '), code('MAX(CAST(SUBSTRING(...)))'), run('. Ahora el siguiente código es 2026080 y continúa la serie.')]));

children.push(...ERR('11', 'Interfaz de usuario',
    'Presencia de emojis en distintas pantallas',
    'Varias pantallas mostraban emojis (íconos de colores) que no correspondían al estilo institucional.',
    'Los emojis se habían usado como íconos improvisados en mensajes, estados y encabezados de varios componentes.',
    'Se revisaron todos los componentes de la interfaz y se reemplazaron los emojis por texto o símbolos neutros, unificando el estilo.'));

children.push(...ERR('12', 'Calidad de datos',
    'Nombres sin formato uniforme',
    'Los nombres de estudiantes y docentes aparecían con mayúsculas y minúsculas inconsistentes.',
    'Los datos provenían del sistema anterior con distintas convenciones de escritura.',
    'Se normalizaron todos los nombres a formato "Título" (primera letra de cada palabra en mayúscula, resto en minúscula): 503 estudiantes y los docentes.'));

// CIERRE
children.push(new Paragraph({
    spacing: { before: 240, after: 0 },
    shading: { type: ShadingType.SOLID, color: 'F6F8FC', fill: 'F6F8FC' },
    border: { left: { color: BLUE, space: 8, style: BorderStyle.SINGLE, size: 18 } },
    indent: { left: 120 },
    children: [
        new TextRun({ text: 'Nota final.  ', font: FONT, size: 21, bold: true, color: BLUE }),
        run('Todas las correcciones fueron verificadas contra la base de datos o mediante pruebas directas antes de darse por cerradas. Este anexo puede incorporarse a la documentación final del proyecto.', { size: 21 })
    ]
}));

const doc = new Document({
    sections: [{
        properties: { page: { margin: { top: 1000, right: 1100, bottom: 900, left: 1100 } } },
        children
    }]
});

Packer.toBuffer(doc).then(buf => {
    fs.writeFileSync('Documentacion_Errores_Corregidos.docx', buf);
    console.log('DOCX creado:', (buf.length / 1024).toFixed(1), 'KB');
}).catch(e => { console.error('ERROR:', e.message); process.exit(1); });
