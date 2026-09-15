// src/application/use-cases/reports/GenerateStudentListing.js
//
// LISTADO DE ESTUDIANTES POR CURSO
//
// Toma los mismos datos del listado que ya usaba el colegio
// ("listas para Fabian.xlsx": colegio, periodo, curso, director, código y
// nombre) y los presenta en una tabla limpia, lista para imprimir.
//
// Es el LISTADO ENUMERADO: número de orden, código y nombre. Nada más,
// para que sirva como lista de clase y quepa holgado en una hoja.
// La ficha con todos los datos del estudiante se genera aparte, en
// GenerateStudentDataSheet (Word y Excel).
//
// Diferencias con el archivo guía, a propósito:
//   - columnas de verdad en vez de texto alineado con espacios, para que se
//     pueda ordenar, filtrar e imprimir sin que se descuadre;
//   - el nombre sale completo (el original lo cortaba a 30 caracteres);
//   - configuración de impresión: vertical, ajustado al ancho de la hoja y
//     con la cabecera repetida en cada página.

const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const { ordenGrado } = require('../../../shared/ordenGrados');
const { NotFoundError, ValidationError } = require('../../../shared/errors');

const COLEGIO = 'COLEGIO SAN JOSÉ DE TARBES';
const TITULO = 'LISTADO DE ESTUDIANTES';

const AZUL = '1F3864';
const AZUL_SUAVE = 'E8EEF7';
const GRIS_LINEA = 'C9D4E5';
const GRIS_FILA = 'F7F9FC';

// Se busca el escudo entre las rutas donde existe en el proyecto.
const RUTAS_LOGO = [
    path.join(__dirname, '../../../assets/logo-colegio.png'),
    path.join(__dirname, '../../../../frontend-react/src/assets/escudo-color.png'),
];
const RUTA_LOGO = RUTAS_LOGO.find(r => fs.existsSync(r)) || null;

// Listado ENUMERADO: la lista de clase, corta y fácil de leer.
// Para la ficha con todos los datos está GenerateStudentDataSheet.
const COLUMNAS = [
    { titulo: 'N°', clave: 'numero', anchoExcel: 7, anchoPdf: 45, alineacion: 'center' },
    { titulo: 'Código', clave: 'codigo', anchoExcel: 16, anchoPdf: 95, alineacion: 'center' },
    { titulo: 'Apellidos y Nombres', clave: 'nombre', anchoExcel: 52, anchoPdf: 321, alineacion: 'left' },
];

const fecha = v => {
    if (!v) return '';
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime())
        ? ''
        : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

/** Nombre de hoja de Excel: sin símbolos prohibidos y máximo 31 caracteres. */
function nombreDeHoja(grado, curso) {
    return `${grado} ${curso}`.replace(/[:\\/?*[\]]/g, '-').trim().slice(0, 31);
}

class GenerateStudentListing {
    constructor(pool) {
        this.pool = pool;
    }

    // ------------------------------------------------------------------
    // Datos
    // ------------------------------------------------------------------
    async obtenerDatos({ academicYearId, gradeId = null, groupId = null, periodId = null }) {
        if (!academicYearId) {
            throw new ValidationError('Falta el año lectivo', 'academicYearId');
        }

        const condiciones = ['e.academic_year_id = ?', 'e.deleted_at IS NULL', 's.deleted_at IS NULL'];
        const parametros = [academicYearId];
        if (groupId) { condiciones.push('grp.id = ?'); parametros.push(groupId); }
        if (gradeId) { condiciones.push('g.id = ?'); parametros.push(gradeId); }

        const [filas] = await this.pool.query(
            `SELECT s.student_code, s.full_name,
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

        // Periodo, solo para el encabezado. Si no se indica, el primero del año.
        const [periodos] = await this.pool.query(
            periodId
                ? 'SELECT `order` FROM periods WHERE id = ? AND deleted_at IS NULL'
                : 'SELECT `order` FROM periods WHERE academic_year_id = ? AND deleted_at IS NULL ORDER BY `order` LIMIT 1',
            [periodId || academicYearId]
        );
        const periodo = periodos[0]?.order ?? null;

        const cursos = [];
        const porId = new Map();

        for (const f of filas) {
            if (!porId.has(f.group_id)) {
                const curso = {
                    titulo: `${f.grade_name} ${f.group_name}`,
                    grado: f.grade_name,
                    curso: f.group_name,
                    director: f.director_name || 'Sin asignar',
                    anoLectivo: f.academic_year_name,
                    periodo,
                    estudiantes: []
                };
                porId.set(f.group_id, curso);
                cursos.push(curso);
            }
            const lista = porId.get(f.group_id).estudiantes;
            lista.push({
                numero: lista.length + 1,               // reinicia en cada curso
                codigo: f.student_code ?? '',
                nombre: f.full_name ?? ''               // ya viene "apellidos nombres"
            });
        }

        return { cursos, anoLectivo: filas[0].academic_year_name };
    }

    async execute({ academicYearId, gradeId = null, groupId = null, periodId = null, formato = 'pdf' }) {
        const datos = await this.obtenerDatos({ academicYearId, gradeId, groupId, periodId });

        if (formato === 'html') {
            return { html: this.generarHTML(datos), esHtml: true };
        }

        const buffer = formato === 'excel'
            ? await this.generarExcel(datos)
            : await this.generarPDF(datos);

        const parte = datos.cursos.length === 1
            ? datos.cursos[0].titulo.replace(/\s+/g, '-')
            : 'GENERAL';

        return {
            buffer,
            nombreArchivo: `LISTADO_${parte}_${datos.anoLectivo}.${formato === 'excel' ? 'xlsx' : 'pdf'}`
                .replace(/[\\/:*?"<>|°]/g, '')
        };
    }

    // ------------------------------------------------------------------
    // HTML — vista previa dentro de la aplicación, lista para imprimir
    // ------------------------------------------------------------------
    generarHTML({ cursos }) {
        const esc = t => String(t ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

        const hoy = new Date().toLocaleDateString('es-CO');

        const secciones = cursos.map((curso, i) => `
    <section class="curso"${i > 0 ? ' style="page-break-before:always"' : ''}>
      <header class="cab">
        <h1>${esc(COLEGIO)}</h1>
        <p class="sub">${esc(TITULO)}</p>
      </header>
      <div class="datos">
        <div><b>Curso:</b> ${esc(curso.titulo)}</div>
        <div><b>Año lectivo:</b> ${esc(curso.anoLectivo)}</div>
        <div><b>Director de curso:</b> ${esc(curso.director)}</div>
        <div><b>Estudiantes:</b> ${curso.estudiantes.length}</div>
      </div>
      <table>
        <thead>
          <tr>${COLUMNAS.map(c => `<th class="al-${c.alineacion}">${esc(c.titulo)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${curso.estudiantes.map(e => `<tr>${COLUMNAS.map(c =>
              `<td class="al-${c.alineacion}">${esc(e[c.clave])}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
      <p class="pie">Generado el ${hoy}</p>
    </section>`).join('');

        return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${esc(TITULO)}${cursos.length === 1 ? ' - ' + esc(cursos[0].titulo) : ''}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #eef1f6;
         font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         color: #1a1a1a; }
  .barra { position: sticky; top: 0; z-index: 10; display: flex; gap: 10px; align-items: center;
           padding: 12px 20px; background: #1f3864; color: #fff; }
  .barra b { font-size: 14px; font-weight: 600; }
  .barra button { margin-left: auto; padding: 8px 18px; font-size: 13px; font-weight: 600;
                  border: 0; border-radius: 6px; background: #fff; color: #1f3864; cursor: pointer; }
  .barra button:hover { background: #e8eef7; }
  .curso { background: #fff; max-width: 820px; margin: 20px auto; padding: 28px 32px;
           box-shadow: 0 1px 4px rgba(0,0,0,.12); }
  .cab { text-align: center; border-bottom: 1px solid #c9d4e5; padding-bottom: 10px; }
  .cab h1 { margin: 0; font-size: 17px; color: #1f3864; letter-spacing: .3px; }
  .cab .sub { margin: 4px 0 0; font-size: 11px; color: #555; }
  .datos { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px;
           margin: 14px 0 16px; font-size: 12px; }
  .datos b { color: #555; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #c9d4e5; padding: 5px 8px; }
  th { background: #e8eef7; color: #1f3864; font-size: 11px; text-transform: none; }
  tbody tr:nth-child(even) { background: #f7f9fc; }
  .al-center { text-align: center; }
  .al-left { text-align: left; }
  .pie { margin: 12px 0 0; font-size: 10px; color: #888; text-align: right; }
  @media print {
    body { background: #fff; }
    .barra { display: none; }
    .curso { box-shadow: none; margin: 0; padding: 0; max-width: none; }
    thead { display: table-header-group; }   /* la cabecera se repite en cada página */
    tr { break-inside: avoid; }
    @page { size: A4 portrait; margin: 14mm; }
  }
</style>
</head>
<body>
  <div class="barra">
    <b>${esc(TITULO)}${cursos.length === 1 ? ' · ' + esc(cursos[0].titulo) : ' · ' + cursos.length + ' cursos'}</b>
    <button onclick="window.print()">Imprimir</button>
  </div>
${secciones}
</body>
</html>`;
    }

    // ------------------------------------------------------------------
    // PDF
    // ------------------------------------------------------------------
    generarPDF({ cursos }) {
        return new Promise((resolver, rechazar) => {
            const doc = new PDFDocument({ margin: 42, size: 'A4' });
            const trozos = [];
            doc.on('data', t => trozos.push(t));
            doc.on('end', () => resolver(Buffer.concat(trozos)));
            doc.on('error', rechazar);

            const IZQ = doc.page.margins.left;
            const ANCHO = COLUMNAS.reduce((s, c) => s + c.anchoPdf, 0);
            const PIE = doc.page.height - doc.page.margins.bottom - 22;
            const ALTO_FILA = 17;

            const celda = (texto, x, y, col, opciones = {}) =>
                doc.text(String(texto ?? ''), x + 5, y + 5, {
                    width: col.anchoPdf - 10,
                    align: col.alineacion,
                    ellipsis: true,
                    lineBreak: false,
                    ...opciones
                });

            const encabezado = (curso) => {
                let y = doc.page.margins.top;

                if (RUTA_LOGO) {
                    try { doc.image(RUTA_LOGO, IZQ, y - 4, { height: 46 }); } catch { /* sin logo */ }
                }

                doc.fillColor(`#${AZUL}`).font('Helvetica-Bold').fontSize(14)
                    .text(COLEGIO, IZQ + 54, y + 2, { width: ANCHO - 54, align: 'center' });
                doc.font('Helvetica').fontSize(10).fillColor('#444')
                    .text(TITULO, IZQ + 54, y + 20, { width: ANCHO - 54, align: 'center' });

                y += 52;
                doc.moveTo(IZQ, y).lineTo(IZQ + ANCHO, y).strokeColor(`#${GRIS_LINEA}`).lineWidth(1).stroke();
                y += 10;

                // Dos columnas de datos del curso
                const mitad = ANCHO / 2;
                const dato = (etiqueta, valor, x, yy) => {
                    doc.font('Helvetica-Bold').fontSize(9).fillColor('#555').text(etiqueta, x, yy, { continued: true });
                    doc.font('Helvetica').fillColor('#000').text(' ' + (valor ?? ''));
                };
                dato('Curso:', curso.titulo, IZQ, y);
                dato('Año lectivo:', curso.anoLectivo, IZQ + mitad, y);
                y += 14;
                dato('Director de curso:', curso.director, IZQ, y);
                dato('Estudiantes:', String(curso.estudiantes.length), IZQ + mitad, y);
                y += 20;

                return cabeceraTabla(y);
            };

            const cabeceraTabla = (y) => {
                doc.rect(IZQ, y, ANCHO, ALTO_FILA + 2).fill(`#${AZUL_SUAVE}`);
                doc.fillColor(`#${AZUL}`).font('Helvetica-Bold').fontSize(9);
                let x = IZQ;
                for (const col of COLUMNAS) { celda(col.titulo, x, y, col); x += col.anchoPdf; }
                doc.fillColor('black');
                return y + ALTO_FILA + 2;
            };

            const pie = () => {
                const n = doc.bufferedPageRange().count;
                doc.font('Helvetica').fontSize(7).fillColor('#888')
                    .text(`Generado el ${new Date().toLocaleDateString('es-CO')}`,
                        IZQ, doc.page.height - doc.page.margins.bottom - 12,
                        { width: ANCHO, align: 'left' })
                    .text(`Página ${n}`,
                        IZQ, doc.page.height - doc.page.margins.bottom - 12,
                        { width: ANCHO, align: 'right' })
                    .fillColor('black');
            };

            cursos.forEach((curso, indice) => {
                if (indice > 0) doc.addPage();
                let y = encabezado(curso);

                curso.estudiantes.forEach((est, i) => {
                    if (y + ALTO_FILA > PIE) {
                        pie();
                        doc.addPage();
                        y = encabezado(curso);
                    }
                    if (i % 2 === 1) doc.rect(IZQ, y, ANCHO, ALTO_FILA).fill(`#${GRIS_FILA}`);

                    doc.fillColor('black').font('Helvetica').fontSize(9);
                    let x = IZQ;
                    for (const col of COLUMNAS) { celda(est[col.clave], x, y, col); x += col.anchoPdf; }
                    y += ALTO_FILA;
                });

                doc.moveTo(IZQ, y).lineTo(IZQ + ANCHO, y).strokeColor(`#${GRIS_LINEA}`).stroke();
                pie();
            });

            doc.end();
        });
    }

    // ------------------------------------------------------------------
    // Excel
    // ------------------------------------------------------------------
    async generarExcel({ cursos }) {
        const libro = new ExcelJS.Workbook();
        libro.creator = COLEGIO;

        const ULTIMA = COLUMNAS.length;
        const borde = { style: 'thin', color: { argb: 'FF' + GRIS_LINEA } };

        for (const curso of cursos) {
            const hoja = libro.addWorksheet(nombreDeHoja(curso.grado, curso.curso), {
                pageSetup: {
                    paperSize: 9,                 // A4
                    orientation: 'portrait',
                    fitToPage: true,
                    fitToWidth: 1,
                    fitToHeight: 0,               // tantas páginas de alto como haga falta
                    margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
                    horizontalCentered: true
                }
            });

            hoja.columns = COLUMNAS.map(c => ({ key: c.clave, width: c.anchoExcel }));

            // ---- Encabezado ----
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

            const info = [
                ['Curso:', curso.titulo, 'Año lectivo:', curso.anoLectivo],
                ['Director de curso:', curso.director, 'Estudiantes:', curso.estudiantes.length],
            ];
            for (const [e1, v1, e2, v2] of info) {
                const f = hoja.addRow([e1, v1, '', e2, v2]);
                f.getCell(1).font = { bold: true, size: 9, color: { argb: 'FF555555' } };
                f.getCell(4).font = { bold: true, size: 9, color: { argb: 'FF555555' } };
                f.getCell(2).font = { size: 9 };
                f.getCell(5).font = { size: 9 };
            }

            hoja.addRow([]);

            // ---- Cabecera de la tabla ----
            const cab = hoja.addRow(COLUMNAS.map(c => c.titulo));
            cab.height = 18;
            cab.eachCell(celda => {
                celda.font = { bold: true, size: 10, color: { argb: 'FF' + AZUL } };
                celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + AZUL_SUAVE } };
                celda.alignment = { horizontal: 'center', vertical: 'middle' };
                celda.border = { top: borde, bottom: borde, left: borde, right: borde };
            });

            const primeraFila = cab.number;

            // ---- Estudiantes ----
            curso.estudiantes.forEach((est, i) => {
                const f = hoja.addRow(COLUMNAS.map(c => est[c.clave]));
                f.eachCell((celda, n) => {
                    celda.font = { size: 10 };
                    celda.alignment = { horizontal: COLUMNAS[n - 1].alineacion, vertical: 'middle' };
                    celda.border = { top: borde, bottom: borde, left: borde, right: borde };
                    if (i % 2 === 1) {
                        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + GRIS_FILA } };
                    }
                });
            });

            // La cabecera se repite al imprimir y queda fija al desplazarse
            hoja.pageSetup.printTitlesRow = `${primeraFila}:${primeraFila}`;
            hoja.views = [{ state: 'frozen', ySplit: primeraFila }];

            hoja.headerFooter = {
                oddFooter: `&LGenerado el ${new Date().toLocaleDateString('es-CO')}&RPágina &P de &N`
            };
        }

        return Buffer.from(await libro.xlsx.writeBuffer());
    }
}

module.exports = GenerateStudentListing;
