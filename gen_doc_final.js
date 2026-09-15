const { Document, Packer, Paragraph, TextRun, AlignmentType,
        Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType } = require('docx');
const fs = require('fs');

const BLUE = '1D4ED8', GRAY = '555555', RED = 'B91C1C', GREEN = '15803D', FONT = 'Georgia';

const run = (t, o = {}) => new TextRun({ text: t, font: FONT, size: o.size || 22, bold: o.bold, italics: o.italics, color: o.color });
const code = (t) => new TextRun({ text: t, font: 'Consolas', size: 20, color: RED });
const P = (c, o = {}) => new Paragraph({ alignment: o.align || AlignmentType.JUSTIFIED, spacing: { after: o.after ?? 100, before: o.before ?? 0, line: 276 }, children: Array.isArray(c) ? c : [run(c, o)] });
const H1 = (t) => new Paragraph({ spacing: { before: 260, after: 80 }, border: { bottom: { color: 'CBD5E1', space: 4, style: BorderStyle.SINGLE, size: 6 } }, children: [new TextRun({ text: t, font: FONT, size: 30, color: BLUE })] });
const H2 = (t) => new Paragraph({ spacing: { before: 160, after: 40 }, children: [new TextRun({ text: t, font: FONT, size: 24, bold: true, color: '1A1A1A' })] });
const LI = (c) => new Paragraph({ alignment: AlignmentType.JUSTIFIED, bullet: { level: 0 }, spacing: { after: 60, line: 276 }, children: Array.isArray(c) ? c : [run(c)] });
const NUM = (c, ref) => new Paragraph({ alignment: AlignmentType.JUSTIFIED, numbering: { reference: ref, level: 0 }, spacing: { after: 60, line: 276 }, children: Array.isArray(c) ? c : [run(c)] });
const NOTA = (label, rest, color = BLUE) => new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 120, after: 120, line: 276 }, shading: { type: ShadingType.SOLID, color: 'F6F8FC', fill: 'F6F8FC' }, border: { left: { color, space: 8, style: BorderStyle.SINGLE, size: 18 } }, indent: { left: 120 }, children: [new TextRun({ text: label + ' ', font: FONT, size: 21, bold: true, color }), ...(Array.isArray(rest) ? rest : [run(rest, { size: 21 })])] });

const border = { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' };
const BORDERS = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
const cellTxt = (t, { bold, header, align } = {}) => new TableCell({ margins: { top: 40, bottom: 40, left: 90, right: 90 }, shading: header ? { type: ShadingType.SOLID, color: BLUE, fill: BLUE } : undefined, children: [new Paragraph({ alignment: align || AlignmentType.LEFT, children: [new TextRun({ text: String(t), font: FONT, size: 19, bold, color: header ? 'FFFFFF' : '1A1A1A' })] })] });
const T = (rows, widths) => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: widths, borders: BORDERS, rows: rows.map((r, ri) => new TableRow({ children: r.map(c => cellTxt(c, { header: ri === 0, bold: ri === 0 })) })) });

const ERR = (num, area, title, sintoma, causa, solucion) => {
    const out = [];
    out.push(new Paragraph({ spacing: { before: 200, after: 40 }, keepNext: true, children: [new TextRun({ text: `${num}. `, font: FONT, size: 23, bold: true, color: BLUE }), new TextRun({ text: title, font: FONT, size: 23, bold: true, color: '1A1A1A' })] }));
    out.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: area, font: FONT, size: 18, italics: true, color: GRAY })] }));
    const field = (label, color, ch) => new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 50, line: 264 }, children: [new TextRun({ text: label + '  ', font: FONT, size: 20, bold: true, color }), ...(Array.isArray(ch) ? ch : [run(ch, { size: 21 })])] });
    out.push(field('Síntoma:', '1A1A1A', sintoma));
    out.push(field('Causa:', RED, causa));
    out.push(field('Solución:', GREEN, solucion));
    return out;
};

const c = [];
const NP = () => c.push(new Paragraph({ pageBreakBefore: true, children: [] }));

// ══════════ PORTADA ══════════
c.push(new Paragraph({ spacing: { before: 2400 }, children: [] }));
c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'COLEGIO SAN JOSÉ DE TARBES', font: FONT, size: 26, color: GRAY, allCaps: true })] }));
c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'Documentación Final', font: FONT, size: 50, color: BLUE })] }));
c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new TextRun({ text: 'Migración, Integración y Correcciones', font: FONT, size: 26, italics: true, color: '444444' })] }));
c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: 'Sistema de Gestión de Notas', font: FONT, size: 22, color: '666666' })] }));
c.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Fecha: julio de 2026', font: FONT, size: 22, color: '666666' })] }));

// ══════════ CONTENIDO ══════════
NP();
c.push(H1('Contenido'));
const toc = (t, p) => c.push(new Paragraph({ spacing: { after: 40 }, tabStops: [{ type: 'right', position: 9000, leader: 'dot' }], children: [new TextRun({ text: t, font: FONT, size: 22 }), new TextRun({ text: '\t' + p, font: FONT, size: 22 })] }));
toc('PARTE I — Migración e Integración de Datos', '3');
toc('   1. Objetivo y alcance', '3');
toc('   2. Sistemas de origen y destino', '3');
toc('   3. Estrategia general de migración', '3');
toc('   4. Detalle de la migración por entidad', '4');
toc('   5. Integración de matrículas históricas', '5');
toc('   6. Resultados finales', '5');
toc('PARTE II — Errores Corregidos', '6');
toc('   Resumen de correcciones', '6');
toc('   Detalle de las correcciones', '6');

// ══════════ PARTE I ══════════
NP();
c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: 'PARTE I', font: FONT, size: 24, bold: true, color: BLUE })] }));
c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: 'Migración e Integración de Datos', font: FONT, size: 30, color: '1A1A1A' })] }));

c.push(H1('1. Objetivo y alcance'));
c.push(P('El objetivo de este proceso fue trasladar la información académica y administrativa del antiguo sistema del Colegio San José de Tarbes hacia la nueva plataforma de gestión de notas, conservando la integridad de los datos y adaptándolos a la nueva estructura.'));
c.push(P('El alcance incluyó la migración de usuarios (administradores y docentes), estudiantes, grados y grupos, directores de grado, matrículas del año en curso, actividades extracurriculares y documentos pendientes; así como la integración de las matrículas históricas de años anteriores.'));

c.push(H1('2. Sistemas de origen y destino'));
c.push(T([
    ['', 'Sistema de origen', 'Sistema de destino'],
    ['Tecnología', 'Laravel (PHP) sobre MariaDB', 'Node.js sobre MySQL'],
    ['Base de datos', 'san_jose_source (temporal)', 'sistema_notas'],
    ['Origen físico', 'Respaldo SanJoseDeTarbes_backup.sql', 'Base de datos productiva'],
], [2000, 3500, 3500]));
c.push(NOTA('Nota.', [run('El respaldo del sistema anterior se importó primero en una base de datos temporal ('), code('san_jose_source'), run('), para leer los datos originales sin alterarlos y transformarlos de forma controlada.', { size: 21 })]));

c.push(H1('3. Estrategia general de migración'));
c.push(P('La migración se realizó mediante scripts automatizados y reproducibles, bajo estos principios:'));
c.push(NUM([run('Importación aislada: ', { bold: true }), run('el respaldo SQL se cargó en una base temporal para no tocar los datos originales.')], 'est'));
c.push(NUM([run('Transformación por entidad: ', { bold: true }), run('cada tabla del origen se adaptó al nuevo modelo manteniendo un mapa de equivalencias de identificadores.')], 'est'));
c.push(NUM([run('Preservación de contraseñas: ', { bold: true }), run('se conservó el hash bcrypt ajustando el prefijo '), code('$2y$'), run(' a '), code('$2b$'), run('.')], 'est'));
c.push(NUM([run('Normalización de nombres: ', { bold: true }), run('los grados se tradujeron a la nueva nomenclatura ('), code('ONCE'), run(' → '), code('11°'), run(').')], 'est'));

c.push(H1('4. Detalle de la migración por entidad'));
c.push(H2('Año lectivo y períodos'));
c.push(P([run('Se creó el año lectivo '), run('2025', { bold: true }), run(' como activo, con sus '), run('cuatro períodos', { bold: true }), run(' (25 % cada uno).')]));
c.push(H2('Grados y grupos'));
c.push(P([run('Los cursos ('), code('cursos'), run(') se dividieron en '), run('grados', { bold: true }), run(' (el nivel) y '), run('grupos', { bold: true }), run(' (la sección A, B…).')]));
c.push(H2('Usuarios, estudiantes y directores'));
c.push(P([run('Los usuarios se combinaron desde '), code('personas'), run(', '), code('usuarios'), run(' y '), code('authss'), run('. Se migraron los estudiantes con todos sus datos y se asignaron los directores por grupo.')]));
c.push(H2('Matrículas y actividades'));
c.push(P([run('Las matrículas del año activo se cargaron en '), code('enrollments'), run(' con folio consecutivo. Se migraron también actividades extracurriculares, actividades por estudiante y documentos pendientes.')]));

c.push(H1('5. Integración de matrículas históricas'));
c.push(P([run('Las matrículas de '), run('2011 a 2024', { bold: true }), run(' se integraron en una tabla independiente, '), code('enrollment_history'), run('. En la plataforma se consultan desde la pestaña '), run('Historial', { bold: true }), run(', que muestra el recorrido año por año de cada estudiante (unificado con el año en curso).')]));

c.push(H1('6. Resultados finales'));
c.push(T([
    ['Entidad', 'Cantidad'],
    ['Grados / Grupos', '15 / 26'],
    ['Administradores / Docentes', '4 / 39'],
    ['Estudiantes', '519'],
    ['Matrículas del año activo (2025)', '481'],
    ['Matrículas históricas (2011 – 2024)', '2.128'],
], [6500, 2500]));

// ══════════ PARTE II ══════════
NP();
c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: 'PARTE II', font: FONT, size: 24, bold: true, color: BLUE })] }));
c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: 'Errores Corregidos', font: FONT, size: 30, color: '1A1A1A' })] }));
c.push(P('Se registran los errores detectados y corregidos durante el desarrollo y la puesta a punto, cada uno con su síntoma, causa y solución.'));

c.push(H2('Resumen de correcciones'));
c.push(T([
    ['#', 'Área', 'Corrección'],
    ['1', 'Migración', 'Nombres vacíos en matrículas históricas'],
    ['2', 'Migración', 'Contraseñas no válidas por prefijo de cifrado'],
    ['3', 'Matrículas', 'Folios desordenados y secciones mezcladas'],
    ['4', 'Matrículas', 'Folio 1 asignado al grupo equivocado'],
    ['5', 'Año lectivo', 'Mostraba "No hay grados" tras reiniciar'],
    ['6', 'Períodos', 'Períodos cerrados automáticamente'],
    ['7', 'Inicio', 'Tarjeta "Grados" contaba niveles, no grupos'],
    ['8', 'Inicio', 'Gráfica de rendimiento mezclaba secciones A y B'],
    ['9', 'Preescolar', 'Niveles de solo matrícula seguían apareciendo'],
    ['10', 'Estudiantes', 'Generación automática de código rota'],
    ['11', 'Interfaz', 'Emojis en distintas pantallas'],
    ['12', 'Datos', 'Nombres sin formato uniforme'],
], [600, 2200, 6200]));

c.push(H2('Detalle de las correcciones'));
c.push(...ERR('1', 'Migración e integración de datos', 'Nombres vacíos en las matrículas históricas',
    'Al migrar las matrículas históricas (2011–2024), los registros quedaban sin el nombre del estudiante.',
    [run('El script leía '), code('nombres'), run('/'), code('apellidos'), run(', pero el origen tenía los campos en singular: '), code('nombre'), run('/'), code('apellido'), run('.')],
    [run('Se corrigió '), code('migrate_history.js'), run(' para leer '), code('CONCAT(nombre, " ", apellido)'), run(', migrando los 2.128 registros.')]));
c.push(...ERR('2', 'Migración e integración de datos', 'Contraseñas no válidas tras la migración',
    'Algunos usuarios no podían iniciar sesión aunque la contraseña fuera correcta.',
    [run('El sistema anterior cifraba con prefijo '), code('$2y$'), run(' y Node.js espera '), code('$2b$'), run(' (mismo bcrypt).')],
    [run('La migración convierte '), code('$2y$'), run(' → '), code('$2b$'), run(' conservando el hash.')]));
c.push(...ERR('3', 'Matrículas — números de folio', 'Folios desordenados y secciones A y B mezcladas',
    'Los folios aparecían desordenados y algunos repetidos; las secciones A y B se intercalaban.',
    [run('Se ordenaba por '), code('RIGHT(g.name, 1)'), run(', que en grados numerados devuelve siempre "°".')],
    [run('Se cambió a '), code("FIELD(grp.name,'A','B',...)"), run(' + nombre, con folios consecutivos por bloque.')]));
c.push(...ERR('4', 'Matrículas — números de folio', 'El folio número 1 pertenecía al grupo equivocado',
    'El folio 1 aparecía en un estudiante de 1°B en lugar de 1°A.',
    'Consecuencia del mismo ordenamiento defectuoso del punto anterior.',
    'Con el nuevo orden por sección, 1°A recibe los primeros folios. Se recalcularon por bloques.'));
c.push(...ERR('5', 'Año lectivo', 'Mostraba "No hay grados" tras reiniciar',
    'Al reiniciar el servidor, la aplicación indicaba que no había grados ni año activo.',
    [run('El proceso '), code('checkAndCloseYear'), run(' cerraba el año porque su '), code('end_date'), run(' ya había pasado.')],
    [run('Se ajustó '), code('end_date'), run(' a una fecha vigente ('), code('2026-12-31'), run(').')]));
c.push(...ERR('6', 'Períodos académicos', 'Los períodos se cerraban solos',
    'Los cuatro períodos aparecían cerrados sin intervención, impidiendo registrar notas.',
    'El mismo proceso de cierre por fecha los marcaba como cerrados al arrancar.',
    [run('Se reabrieron ('), code("status='open'"), run(') y se corrigieron las fechas.')]));
c.push(...ERR('7', 'Panel de inicio', 'La tarjeta "Grados" mostraba un número incorrecto',
    'Mostraba "15", aunque el subtítulo decía "Grupos activos".',
    [run('Contaba la tabla '), code('grades'), run(' (niveles), no los grupos con matrícula.')],
    [run('Se cambió a contar los '), run('grupos activos', { bold: true }), run(' del año en curso.')]));
c.push(...ERR('8', 'Panel de inicio', 'La gráfica de rendimiento mezclaba las secciones A y B',
    'Cada grado mostraba una sola barra, uniendo 1°A y 1°B.',
    [run('Agrupaba por '), code('grades.id'), run(', fusionando las secciones.')],
    [run('Se agrupó por '), code('groups.id'), run(': "1° A", "1° B"… como barras independientes.')]));
c.push(...ERR('9', 'Grados de solo matrícula (preescolar)', 'Los niveles de preescolar seguían apareciendo',
    'Tras marcarlos como "solo matrícula", aún aparecían en Asignaciones.',
    [run('El controlador de grupos '), run('descartaba la bandera ', { bold: true }), code('takes_grades'), run(' al reconstruir cada grupo.')],
    [run('Se incluyó '), code('takes_grades'), run(' en la respuesta; preescolar desaparece de Asignaciones, Registro de Notas y Reportes.')]));
c.push(...ERR('10', 'Estudiantes — código automático', 'La generación de código no continuaba la secuencia',
    'El código propuesto reiniciaba en "2026-001" en vez de continuar desde 2026079.',
    [run('Generaba con guion ('), code('2026-001'), run(') y buscaba con '), code("LIKE '2026-%'"), run('; los reales no llevan guion.')],
    [run('Se usó el mismo formato sin guion y el '), run('máximo real', { bold: true }), run(' con '), code('MAX(CAST(SUBSTRING(...)))'), run('. Ahora sigue: 2026080.')]));
c.push(...ERR('11', 'Interfaz de usuario', 'Presencia de emojis en distintas pantallas',
    'Varias pantallas mostraban emojis que no correspondían al estilo institucional.',
    'Se habían usado como íconos improvisados en mensajes y encabezados.',
    'Se reemplazaron por texto o símbolos neutros en todos los componentes.'));
c.push(...ERR('12', 'Calidad de datos', 'Nombres sin formato uniforme',
    'Nombres de estudiantes y docentes con mayúsculas/minúsculas inconsistentes.',
    'Provenían del sistema anterior con distintas convenciones.',
    'Se normalizaron a formato "Título" (503 estudiantes y docentes).'));

c.push(NOTA('Nota final.', run('Todas las correcciones se verificaron contra la base de datos o mediante pruebas directas antes de darse por cerradas.', { size: 21 })));

const doc = new Document({
    numbering: { config: [{ reference: 'est', levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START, style: { paragraph: { indent: { left: 460, hanging: 260 } } } }] }] },
    sections: [{ properties: { page: { margin: { top: 1000, right: 1100, bottom: 900, left: 1100 } } }, children: c }]
});
Packer.toBuffer(doc).then(buf => { fs.writeFileSync('Documentacion_Final.docx', buf); console.log('DOCX creado:', (buf.length / 1024).toFixed(1), 'KB'); }).catch(e => { console.error('ERROR:', e.message); process.exit(1); });
