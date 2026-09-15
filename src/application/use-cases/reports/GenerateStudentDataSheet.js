// src/application/use-cases/reports/GenerateStudentDataSheet.js
//
// LISTADO DE DATOS DE LOS ESTUDIANTES
//
// A diferencia del listado enumerado (GenerateStudentListing), que es la lista
// de clase corta, este saca TODOS los datos de cada estudiante: documento y su
// expedición, fecha de nacimiento, teléfonos, correos, dirección, acudiente y
// fechas de ingreso y retiro.
//
// Se genera en Word y en Excel:
//   - Excel: una hoja por curso, una fila por estudiante. Sirve para filtrar,
//     ordenar y cruzar datos.
//   - Word: una ficha por estudiante, con los campos en dos columnas. Sirve
//     para imprimir y archivar en físico.

const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    WidthType, AlignmentType, BorderStyle, ImageRun, HeadingLevel
} = require('docx');

const { ordenGrado } = require('../../../shared/ordenGrados');
const { NotFoundError, ValidationError } = require('../../../shared/errors');

const COLEGIO = 'COLEGIO SAN JOSÉ DE TARBES';
const TITULO = 'LISTADO DE DATOS DE LOS ESTUDIANTES';

const AZUL = '1F3864';
const AZUL_SUAVE = 'E8EEF7';
const GRIS_LINEA = 'C9D4E5';
const GRIS_FILA = 'F7F9FC';

const RUTAS_LOGO = [
    path.join(__dirname, '../../../assets/logo-colegio.png'),
    path.join(__dirname, '../../../../frontend-react/src/assets/escudo-color.png'),
];
const RUTA_LOGO = RUTAS_LOGO.find(r => fs.existsSync(r)) || null;

/** Fecha en formato local dd/mm/aaaa. No usa toISOString, que corre el día. */
const fecha = (v) => {
    if (!v) return '';
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

// Todas las columnas del listado de datos, en el orden en que se muestran.
const CAMPOS = [
    { titulo: 'N°', clave: 'numero', ancho: 6 },
    { titulo: 'Código', clave: 'codigo', ancho: 12 },
    { titulo: 'Apellidos', clave: 'apellidos', ancho: 26 },
    { titulo: 'Nombres', clave: 'nombres', ancho: 24 },
    { titulo: 'Tipo doc.', clave: 'tipoDocumento', ancho: 10 },
    { titulo: 'N° documento', clave: 'documento', ancho: 16 },
    { titulo: 'Expedición', clave: 'expedicionFecha', ancho: 13 },
    { titulo: 'Lugar de expedición', clave: 'expedicionLugar', ancho: 22 },
    { titulo: 'F. nacimiento', clave: 'nacimiento', ancho: 13 },
    { titulo: 'F. ingreso', clave: 'ingreso', ancho: 13 },
    { titulo: 'Teléfono fijo', clave: 'telefonoFijo', ancho: 14 },
    { titulo: 'Celular del padre', clave: 'celularPadre', ancho: 16 },
    { titulo: 'Celular de la madre', clave: 'celularMadre', ancho: 17 },
    { titulo: 'Correo del padre', clave: 'correoPadre', ancho: 28 },
    { titulo: 'Correo de la madre', clave: 'correoMadre', ancho: 28 },
    { titulo: 'Dirección', clave: 'direccion', ancho: 34 },
    { titulo: 'Acudiente', clave: 'acudiente', ancho: 38 },
    { titulo: 'F. retiro', clave: 'retiroFecha', ancho: 12 },
    { titulo: 'Motivo del retiro', clave: 'retiroMotivo', ancho: 26 },
];

function nombreDeHoja(titulo) {
    return String(titulo).replace(/[:\\/?*[\]]/g, '-').trim().slice(0, 31);
}

class GenerateStudentDataSheet {
    constructor(pool) {
        this.pool = pool;
    }

    // ------------------------------------------------------------------
    // Datos
    // ------------------------------------------------------------------
    async obtenerDatos({ academicYearId, gradeId = null, groupId = null }) {
        if (!academicYearId) {
            throw new ValidationError('Falta el año lectivo', 'academicYearId');
        }

        const condiciones = ['e.academic_year_id = ?', 'e.deleted_at IS NULL', 's.deleted_at IS NULL'];
        const parametros = [academicYearId];
        if (groupId) { condiciones.push('grp.id = ?'); parametros.push(groupId); }
        if (gradeId) { condiciones.push('g.id = ?'); parametros.push(gradeId); }

        const [filas] = await this.pool.query(
            `SELECT s.student_code, s.last_name, s.first_name, s.full_name,
                    s.document_type, s.document_number,
                    s.document_issue_date, s.document_issue_place,
                    s.birth_date, s.admission_date,
                    s.phone_landline, s.phone_mobile1, s.phone_mobile2,
                    s.email_father, s.email_mother, s.address, s.guardian,
                    s.withdrawal_date, s.withdrawal_reason,
                    g.name   AS grade_name,
                    grp.id   AS group_id, grp.name AS group_name,
                    u.name   AS director_name,
                    ay.name  AS academic_year_name
               FROM enrollments e
               JOIN students s      ON e.student_id = s.id
               JOIN \`groups\` grp   ON e.group_id = grp.id
               JOIN grades g        ON grp.grade_id = g.id
               JOIN academic_years ay ON e.academic_year_id = ay.id
               LEFT JOIN users u    ON g.head_teacher_id = u.id
              WHERE ${condiciones.join(' AND ')}
              ORDER BY ${ordenGrado('g.name')} ASC, grp.name ASC,
                       s.last_name ASC, s.first_name ASC`,
            parametros
        );

        if (filas.length === 0) {
            throw new NotFoundError('No hay estudiantes matriculados para ese listado');
        }

        const cursos = [];
        const porId = new Map();

        for (const f of filas) {
            if (!porId.has(f.group_id)) {
                const curso = {
                    titulo: `${f.grade_name} ${f.group_name}`,
                    director: f.director_name || 'Sin asignar',
                    anoLectivo: f.academic_year_name,
                    estudiantes: []
                };
                porId.set(f.group_id, curso);
                cursos.push(curso);
            }
            const lista = porId.get(f.group_id).estudiantes;
            lista.push({
                numero: lista.length + 1,
                codigo: f.student_code ?? '',
                apellidos: f.last_name ?? '',
                nombres: f.first_name ?? '',
                nombreCompleto: f.full_name ?? '',
                tipoDocumento: f.document_type ?? '',
                documento: f.document_number ?? '',
                expedicionFecha: fecha(f.document_issue_date),
                expedicionLugar: f.document_issue_place ?? '',
                nacimiento: fecha(f.birth_date),
                ingreso: fecha(f.admission_date),
                telefonoFijo: f.phone_landline ?? '',
                celularPadre: f.phone_mobile1 ?? '',
                celularMadre: f.phone_mobile2 ?? '',
                correoPadre: f.email_father ?? '',
                correoMadre: f.email_mother ?? '',
                direccion: f.address ?? '',
                acudiente: f.guardian ?? '',
                retiroFecha: fecha(f.withdrawal_date),
                retiroMotivo: f.withdrawal_reason ?? ''
            });
        }

        return { cursos, anoLectivo: filas[0].academic_year_name };
    }

    async execute({ academicYearId, gradeId = null, groupId = null, formato = 'excel' }) {
        const datos = await this.obtenerDatos({ academicYearId, gradeId, groupId });

        const buffer = formato === 'word'
            ? await this.generarWord(datos)
            : await this.generarExcel(datos);

        const parte = datos.cursos.length === 1
            ? datos.cursos[0].titulo.replace(/\s+/g, '-')
            : 'GENERAL';

        return {
            buffer,
            nombreArchivo: `DATOS_ESTUDIANTES_${parte}_${datos.anoLectivo}.${formato === 'word' ? 'docx' : 'xlsx'}`
                .replace(/[\\/:*?"<>|°]/g, '')
        };
    }

    // ------------------------------------------------------------------
    // Excel — una hoja por curso, una fila por estudiante
    // ------------------------------------------------------------------
    async generarExcel({ cursos }) {
        const libro = new ExcelJS.Workbook();
        libro.creator = COLEGIO;

        const ULTIMA = CAMPOS.length;
        const borde = { style: 'thin', color: { argb: 'FF' + GRIS_LINEA } };

        for (const curso of cursos) {
            const hoja = libro.addWorksheet(nombreDeHoja(curso.titulo), {
                pageSetup: {
                    paperSize: 9,
                    orientation: 'landscape',      // son muchas columnas
                    fitToPage: true,
                    fitToWidth: 1,
                    fitToHeight: 0,
                    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
                }
            });

            hoja.columns = CAMPOS.map(c => ({ key: c.clave, width: c.ancho }));

            const titulo = hoja.addRow([COLEGIO]);
            hoja.mergeCells(titulo.number, 1, titulo.number, ULTIMA);
            titulo.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF' + AZUL } };
            titulo.getCell(1).alignment = { horizontal: 'center' };
            titulo.height = 20;

            const sub = hoja.addRow([TITULO]);
            hoja.mergeCells(sub.number, 1, sub.number, ULTIMA);
            sub.getCell(1).font = { size: 10, color: { argb: 'FF444444' } };
            sub.getCell(1).alignment = { horizontal: 'center' };

            hoja.addRow([]);

            for (const [e1, v1, e2, v2] of [
                ['Curso:', curso.titulo, 'Año lectivo:', curso.anoLectivo],
                ['Director de curso:', curso.director, 'Estudiantes:', curso.estudiantes.length],
            ]) {
                const f = hoja.addRow([e1, v1, '', e2, v2]);
                f.getCell(1).font = { bold: true, size: 9, color: { argb: 'FF555555' } };
                f.getCell(4).font = { bold: true, size: 9, color: { argb: 'FF555555' } };
            }

            hoja.addRow([]);

            const cab = hoja.addRow(CAMPOS.map(c => c.titulo));
            cab.height = 26;
            cab.eachCell(celda => {
                celda.font = { bold: true, size: 9, color: { argb: 'FF' + AZUL } };
                celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + AZUL_SUAVE } };
                celda.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                celda.border = { top: borde, bottom: borde, left: borde, right: borde };
            });
            const primeraFila = cab.number;

            curso.estudiantes.forEach((est, i) => {
                const f = hoja.addRow(CAMPOS.map(c => est[c.clave]));
                f.eachCell((celda, n) => {
                    celda.font = { size: 9 };
                    celda.alignment = {
                        horizontal: ['numero', 'codigo', 'tipoDocumento'].includes(CAMPOS[n - 1].clave) ? 'center' : 'left',
                        vertical: 'middle'
                    };
                    celda.border = { top: borde, bottom: borde, left: borde, right: borde };
                    if (i % 2 === 1) {
                        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + GRIS_FILA } };
                    }
                });
            });

            // Cabecera repetida al imprimir, fija en pantalla y con filtros
            hoja.pageSetup.printTitlesRow = `${primeraFila}:${primeraFila}`;
            hoja.views = [{ state: 'frozen', xSplit: 4, ySplit: primeraFila }];
            hoja.autoFilter = {
                from: { row: primeraFila, column: 1 },
                to: { row: primeraFila + curso.estudiantes.length, column: ULTIMA }
            };
            hoja.headerFooter = {
                oddFooter: `&LGenerado el ${new Date().toLocaleDateString('es-CO')}&RPágina &P de &N`
            };
        }

        return Buffer.from(await libro.xlsx.writeBuffer());
    }

    // ------------------------------------------------------------------
    // Word — una ficha por estudiante
    // ------------------------------------------------------------------
    async generarWord({ cursos }) {
        const BORDE = { style: BorderStyle.SINGLE, size: 4, color: GRIS_LINEA };
        const BORDES = { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE };

        const texto = (t, opciones = {}) => new Paragraph({
            children: [new TextRun({ text: String(t ?? ''), size: 18, ...opciones })],
            spacing: { before: 0, after: 0 }
        });

        const etiqueta = (t) => new TableCell({
            width: { size: 2100, type: WidthType.DXA },
            borders: BORDES,
            shading: { fill: AZUL_SUAVE },
            margins: { top: 60, bottom: 60, left: 90, right: 90 },
            children: [texto(t, { bold: true, color: AZUL })]
        });

        const valor = (t, ancho = 3300) => new TableCell({
            width: { size: ancho, type: WidthType.DXA },
            borders: BORDES,
            margins: { top: 60, bottom: 60, left: 90, right: 90 },
            children: [texto(t)]
        });

        const fila = (e1, v1, e2, v2) => new TableRow({
            children: e2 === undefined
                ? [etiqueta(e1), new TableCell({
                    width: { size: 8700, type: WidthType.DXA }, columnSpan: 3,
                    borders: BORDES, margins: { top: 60, bottom: 60, left: 90, right: 90 },
                    children: [texto(v1)]
                })]
                : [etiqueta(e1), valor(v1), etiqueta(e2), valor(v2)]
        });

        const secciones = cursos.map((curso, indiceCurso) => {
            const hijos = [];

            if (RUTA_LOGO) {
                try {
                    hijos.push(new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new ImageRun({
                            data: fs.readFileSync(RUTA_LOGO),
                            transformation: { width: 58, height: 58 }
                        })]
                    }));
                } catch { /* sin logo */ }
            }

            hijos.push(
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: COLEGIO, bold: true, size: 28, color: AZUL })]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 120 },
                    children: [new TextRun({ text: TITULO, size: 18, color: '444444' })]
                }),
                new Paragraph({
                    spacing: { after: 200 },
                    children: [
                        new TextRun({ text: 'Curso: ', bold: true, size: 18 }),
                        new TextRun({ text: curso.titulo + '     ', size: 18 }),
                        new TextRun({ text: 'Año lectivo: ', bold: true, size: 18 }),
                        new TextRun({ text: curso.anoLectivo + '     ', size: 18 }),
                        new TextRun({ text: 'Director de curso: ', bold: true, size: 18 }),
                        new TextRun({ text: curso.director, size: 18 })
                    ]
                })
            );

            for (const e of curso.estudiantes) {
                hijos.push(new Paragraph({
                    spacing: { before: 160, after: 60 },
                    children: [new TextRun({
                        text: `${e.numero}.  ${e.nombreCompleto}`,
                        bold: true, size: 20, color: AZUL
                    })]
                }));

                hijos.push(new Table({
                    width: { size: 10800, type: WidthType.DXA },
                    columnWidths: [2100, 3300, 2100, 3300],
                    rows: [
                        fila('Código', e.codigo, 'Documento', `${e.tipoDocumento} ${e.documento}`.trim()),
                        fila('Expedición', e.expedicionFecha, 'Lugar de expedición', e.expedicionLugar),
                        fila('F. nacimiento', e.nacimiento, 'F. ingreso', e.ingreso),
                        fila('Teléfono fijo', e.telefonoFijo, 'Celular del padre', e.celularPadre),
                        fila('Celular de la madre', e.celularMadre, 'Correo del padre', e.correoPadre),
                        fila('Correo de la madre', e.correoMadre, 'F. retiro', e.retiroFecha),
                        fila('Dirección', e.direccion),
                        fila('Acudiente', e.acudiente),
                        ...(e.retiroMotivo ? [fila('Motivo del retiro', e.retiroMotivo)] : [])
                    ]
                }));
            }

            hijos.push(new Paragraph({
                spacing: { before: 240 },
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({
                    text: `Generado el ${new Date().toLocaleDateString('es-CO')}`,
                    size: 14, color: '888888'
                })]
            }));

            return {
                properties: indiceCurso === 0 ? {} : { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
                children: hijos
            };
        });

        const doc = new Document({
            creator: COLEGIO,
            title: TITULO,
            sections: secciones.map(s => ({
                properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
                children: s.children
            }))
        });

        return await Packer.toBuffer(doc);
    }
}

module.exports = GenerateStudentDataSheet;
