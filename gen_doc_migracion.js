const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
        Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType } = require('docx');
const fs = require('fs');

const BLUE = '1D4ED8';
const GRAY = '555555';
const FONT = 'Georgia';

// ---- Helpers ----
const P = (text, opts = {}) => new Paragraph({
    alignment: opts.align || AlignmentType.JUSTIFIED,
    spacing: { after: opts.after ?? 120, before: opts.before ?? 0, line: 276 },
    children: Array.isArray(text) ? text : [new TextRun({ text, font: FONT, size: opts.size || 22, color: opts.color, bold: opts.bold, italics: opts.italics })]
});

const run = (text, o = {}) => new TextRun({ text, font: FONT, size: o.size || 22, bold: o.bold, italics: o.italics, color: o.color });
const code = (text) => new TextRun({ text, font: 'Consolas', size: 20, color: 'B91C1C' });

const H1 = (text) => new Paragraph({
    spacing: { before: 260, after: 80 },
    border: { bottom: { color: 'CBD5E1', space: 4, style: BorderStyle.SINGLE, size: 6 } },
    children: [new TextRun({ text, font: FONT, size: 30, color: BLUE })]
});
const H2 = (text) => new Paragraph({
    spacing: { before: 160, after: 40 },
    children: [new TextRun({ text, font: FONT, size: 24, bold: true, color: '1A1A1A' })]
});
const LI = (children) => new Paragraph({
    alignment: AlignmentType.JUSTIFIED, bullet: { level: 0 },
    spacing: { after: 60, line: 276 },
    children: Array.isArray(children) ? children : [run(children)]
});
const NUM = (children, ref) => new Paragraph({
    alignment: AlignmentType.JUSTIFIED, numbering: { reference: ref, level: 0 },
    spacing: { after: 60, line: 276 },
    children: Array.isArray(children) ? children : [run(children)]
});

// Nota (callout)
const NOTA = (label, rest) => new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 120, after: 120, line: 276 },
    shading: { type: ShadingType.SOLID, color: 'F6F8FC', fill: 'F6F8FC' },
    border: { left: { color: BLUE, space: 8, style: BorderStyle.SINGLE, size: 18 } },
    indent: { left: 120 },
    children: [new TextRun({ text: label + ' ', font: FONT, size: 21, bold: true, color: BLUE }), ...(Array.isArray(rest) ? rest : [run(rest, { size: 21 })])]
});

// ---- Tablas ----
const border = { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' };
const BORDERS = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
const cellTxt = (text, { bold, header, align, mono } = {}) => new TableCell({
    margins: { top: 40, bottom: 40, left: 90, right: 90 },
    shading: header ? { type: ShadingType.SOLID, color: BLUE, fill: BLUE } : undefined,
    children: [new Paragraph({
        alignment: align || AlignmentType.LEFT,
        children: [new TextRun({ text: String(text), font: mono ? 'Consolas' : FONT, size: 20, bold, color: header ? 'FFFFFF' : '1A1A1A' })]
    })]
});
const T = (rows, widths) => new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: widths,
    borders: BORDERS,
    rows: rows.map((r, ri) => new TableRow({
        children: r.map((c, ci) => typeof c === 'object' && c.cell ? c.cell : cellTxt(c, { header: ri === 0, bold: ri === 0, align: ci > 0 && typeof c === 'string' ? undefined : undefined }))
    }))
});

const spacer = () => new Paragraph({ spacing: { after: 60 }, children: [] });

// =========================================================
const children = [];

// PORTADA
children.push(new Paragraph({ spacing: { before: 2600 }, children: [] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
    children: [new TextRun({ text: 'COLEGIO SAN JOSÉ DE TARBES', font: FONT, size: 26, color: GRAY, allCaps: true })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [new TextRun({ text: 'Migración e Integración de Datos', font: FONT, size: 56, color: BLUE })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
    children: [new TextRun({ text: 'Documentación técnica del proceso', font: FONT, size: 28, italics: true, color: '444444' })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: 'Sistema de Gestión de Notas', font: FONT, size: 22, color: '666666' })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: 'Del sistema anterior (Laravel / MariaDB) al nuevo sistema (Node.js / MySQL)', font: FONT, size: 22, color: '666666' })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Fecha: 2 de julio de 2026', font: FONT, size: 22, color: '666666' })] }));
children.push(new Paragraph({ pageBreakBefore: true, children: [] }));

// 1
children.push(H1('1. Objetivo y alcance'));
children.push(P('El objetivo de este proceso fue trasladar la información académica y administrativa del antiguo sistema del Colegio San José de Tarbes hacia la nueva plataforma de gestión de notas, conservando la integridad de los datos y adaptándolos a la nueva estructura.'));
children.push(P('El alcance incluyó la migración de usuarios (administradores y docentes), estudiantes, grados y grupos, directores de grado, matrículas del año en curso, actividades extracurriculares y documentos pendientes; así como la integración de las matrículas históricas de años anteriores, que representan la memoria académica de la institución.'));

// 2
children.push(H1('2. Sistemas de origen y destino'));
children.push(T([
    ['', 'Sistema de origen', 'Sistema de destino'],
    ['Tecnología', 'Laravel (PHP) sobre MariaDB', 'Node.js sobre MySQL'],
    ['Base de datos', 'san_jose_source (temporal)', 'sistema_notas'],
    ['Origen físico', 'Respaldo SanJoseDeTarbes_backup.sql', 'Base de datos productiva'],
    ['Modelo de datos', 'Nombres en español, una sola tabla de personas', 'Arquitectura por capas, entidades separadas'],
], [2000, 3500, 3500]));
children.push(NOTA('Nota.', [run('El respaldo del sistema anterior se importó primero en una base de datos temporal (', { size: 21 }), code('san_jose_source'), run('). Esto permitió leer los datos originales sin alterarlos y transformarlos de forma controlada hacia la base definitiva.', { size: 21 })]));

// 3
children.push(H1('3. Estrategia general de migración'));
children.push(P('La migración se realizó mediante scripts automatizados que ejecutan el proceso completo de manera reproducible. La estrategia siguió estos principios:'));
children.push(NUM([run('Importación aislada: ', { bold: true }), run('el respaldo SQL se cargó en una base temporal para no tocar los datos originales.')], 'estrategia'));
children.push(NUM([run('Transformación por entidad: ', { bold: true }), run('cada tabla del origen se leyó, se adaptó al nuevo modelo y se escribió en la base destino, manteniendo un mapa de equivalencias entre los identificadores antiguos y los nuevos.')], 'estrategia'));
children.push(NUM([run('Preservación de contraseñas: ', { bold: true }), run('las contraseñas cifradas se conservaron tal cual, ajustando únicamente el prefijo del cifrado ('), code('$2y$'), run(' a '), code('$2b$'), run('), que corresponde al mismo algoritmo bcrypt. Así, cada usuario conserva su contraseña original.')], 'estrategia'));
children.push(NUM([run('Normalización de nombres: ', { bold: true }), run('los nombres de grados se tradujeron a la nueva nomenclatura (por ejemplo, '), code('ONCE'), run(' pasó a '), code('11°'), run(').')], 'estrategia'));
children.push(H2('Mapa de nomenclatura de grados'));
children.push(T([
    ['Origen', 'Destino', 'Origen', 'Destino'],
    ['ONCE', '11°', 'QUINTO', '5°'],
    ['DECIMO', '10°', 'CUARTO', '4°'],
    ['NOVENO', '9°', 'TERCERO', '3°'],
    ['OCTAVO', '8°', 'SEGUNDO', '2°'],
    ['SEPTIMO', '7°', 'PRIMERO', '1°'],
    ['SEXTO', '6°', 'TRANSICION / JARDIN / etc.', 'Transición / Jardín / …'],
], [2200, 2200, 2400, 2200]));

// 4
children.push(H1('4. Detalle de la migración por entidad'));
children.push(H2('Año lectivo y períodos'));
children.push(P([run('Se creó el año lectivo '), run('2025', { bold: true }), run(' como año activo y se definieron sus '), run('cuatro períodos académicos', { bold: true }), run(', cada uno con un peso del 25 % y con sus respectivas fechas de inicio y cierre.')]));
children.push(H2('Grados y grupos'));
children.push(P([run('Los cursos del sistema anterior (tabla '), code('cursos'), run(') se dividieron en dos entidades: '), run('grados', { bold: true }), run(' (el nivel, como 6°) y '), run('grupos', { bold: true }), run(' (la sección, como A o B). De este modo, un mismo grado puede tener varios grupos independientes.')]));
children.push(H2('Usuarios (administradores y docentes)'));
children.push(P([run('La información de usuarios provenía de tres tablas del origen: '), code('personas'), run(' (datos personales), '), code('usuarios'), run(' (rol) y '), code('authss'), run(' (credenciales). Estas se combinaron en la tabla única '), code('users'), run('. El rol se asignó así: administrador y secretaria pasaron a '), run('admin', { bold: true }), run(', y el resto a '), run('docente', { bold: true }), run('. Los registros con rol estudiante no generaron usuario, ya que los estudiantes no acceden a la plataforma.')]));
children.push(H2('Directores de grado'));
children.push(P([run('La relación de directores (tabla '), code('directores__cursos'), run(') se trasladó de manera que cada '), run('grupo', { bold: true }), run(' (A y B por separado) quedara con su director correcto, buscando la coincidencia por nombre entre el docente del origen y el usuario del destino.')]));
children.push(H2('Estudiantes'));
children.push(P([run('Los estudiantes (tabla '), code('estudiantes'), run(') se migraron con todos sus datos: nombre completo, código, tipo de documento, teléfonos, correos de los padres, dirección, acudiente, fechas de nacimiento e ingreso, y observaciones.')]));
children.push(H2('Matrículas del año en curso'));
children.push(P([run('Las matrículas del año activo se cargaron en la tabla '), code('enrollments'), run(', vinculando cada estudiante con su grupo y grado, y asignando a cada una un '), run('número de folio', { bold: true }), run(' consecutivo.')]));
children.push(H2('Actividades y documentos'));
children.push(P([run('Se migraron también las '), run('actividades extracurriculares', { bold: true }), run(', la relación de '), run('actividades por estudiante', { bold: true }), run(' y los '), run('documentos pendientes', { bold: true }), run(' de cada estudiante.')]));

// 5
children.push(H1('5. Integración de matrículas históricas'));
children.push(P([run('Además de la migración del año en curso, se integró la '), run('memoria histórica de matrículas', { bold: true }), run(' de años anteriores. Este fue uno de los aportes centrales de la integración.')]));
children.push(P([run('Las matrículas de los años '), run('2011 a 2024', { bold: true }), run(' se cargaron en una tabla independiente, '), code('enrollment_history'), run(', separada de las matrículas activas para no mezclar la información del año en curso con la histórica. Cada registro conserva el código y nombre del estudiante, el grado y grupo cursado, el año académico y el valor de la matrícula.')]));
children.push(P([run('En la plataforma, esta información se consulta desde el módulo de matrículas, en la pestaña '), run('Historial', { bold: true }), run(': se muestra la lista de estudiantes y, al pulsar '), run('"Ver historial"', { bold: true }), run(', se despliega el recorrido año por año de cada estudiante.')]));

// 6
children.push(H1('6. Ajustes posteriores (post-migración)'));
children.push(P('Una vez migrados los datos, se realizaron varios ajustes de calidad para dejar la información consistente:'));
children.push(LI([run('Normalización de nombres: ', { bold: true }), run('los nombres de estudiantes y docentes se ajustaron para que la primera letra de cada palabra quedara en mayúscula y el resto en minúscula.')]));
children.push(LI([run('Recálculo de folios: ', { bold: true }), run('los números de folio se reorganizaron por bloques de grados y ordenados por grupo (A antes que B), de modo que la numeración fuera coherente dentro de cada curso.')]));
children.push(LI([run('Directores por grupo: ', { bold: true }), run('se corrigió la asignación para que cada sección (A y B) tuviera su director independiente.')]));
children.push(LI([run('Verificación de períodos y año activo: ', { bold: true }), run('se confirmó que el año lectivo y sus períodos quedaran correctamente abiertos y activos.')]));

// 7
children.push(H1('7. Resultados finales'));
children.push(P('La siguiente tabla resume el volumen de datos migrados e integrados, verificado directamente en la base de datos.'));
children.push(T([
    ['Entidad', 'Cantidad'],
    ['Años lectivos', '1'],
    ['Períodos académicos', '4'],
    ['Grados', '15'],
    ['Grupos', '26'],
    ['Usuarios (administradores)', '4'],
    ['Usuarios (docentes)', '39'],
    ['Estudiantes', '519'],
    ['Matrículas del año activo (2025)', '481'],
    ['Matrículas históricas (2011 – 2024)', '2.128'],
    ['Años históricos integrados', '14'],
    ['Actividades extracurriculares', '7'],
    ['Actividades de estudiantes', '4'],
], [6500, 2500]));
children.push(NOTA('Conclusión.', run('La migración trasladó de forma íntegra la información operativa del colegio al nuevo sistema, y la integración de más de dos mil matrículas históricas de catorce años permite consultar el recorrido académico completo de cada estudiante desde la nueva plataforma.', { size: 21 })));

const doc = new Document({
    numbering: {
        config: [{
            reference: 'estrategia',
            levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START, style: { paragraph: { indent: { left: 460, hanging: 260 } } } }]
        }]
    },
    sections: [{
        properties: { page: { margin: { top: 1000, right: 1100, bottom: 900, left: 1100 } } },
        children
    }]
});

Packer.toBuffer(doc).then(buf => {
    fs.writeFileSync('Documentacion_Migracion.docx', buf);
    console.log('DOCX creado:', (buf.length / 1024).toFixed(1), 'KB');
}).catch(e => { console.error('ERROR:', e.message); process.exit(1); });
