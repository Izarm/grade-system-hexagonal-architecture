// src/application/use-cases/reports/GenerateBulkReportHTML.js
// Genera UN solo documento HTML con los boletines de varios estudiantes,
// cada uno en su propia página, y con auto-impresión al abrirlo.
// Mismo formato que los informes Word (guía del colegio).
const fs = require('fs');
const path = require('path');

const MAX_REVIEW_CHARS = 600;

function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function fix1(v) {
    return (v === null || v === undefined || v === '' || isNaN(parseFloat(v))) ? '-' : parseFloat(v).toFixed(1);
}
function cleanElectiveName(n) {
    return String(n || '').replace(/^\s*\d+\s*/, '').trim().toUpperCase();
}

class GenerateBulkReportHTML {
    constructor(pool) {
        this.pool = pool;
    }

    async execute({ academicYearId, gradeId, groupId, type = 'period', periodId }) {
        academicYearId = parseInt(academicYearId);
        const isMassive = type === 'massive_period' || type === 'massive_final';
        const isFinal = type === 'final' || type === 'massive_final';

        // Año lectivo
        const [yearRows] = await this.pool.query('SELECT name FROM academic_years WHERE id = ?', [academicYearId]);
        const academicYear = yearRows[0]?.name || '';

        // Período (para reportes de período)
        let periodOrder = null;
        if (!isFinal) {
            if (!periodId) {
                const [p] = await this.pool.query('SELECT id, `order` FROM periods WHERE academic_year_id = ? ORDER BY `order` LIMIT 1', [academicYearId]);
                periodId = p[0]?.id;
                periodOrder = p[0]?.order;
            } else {
                const [p] = await this.pool.query('SELECT `order` FROM periods WHERE id = ?', [parseInt(periodId)]);
                periodOrder = p[0]?.order;
            }
            periodId = parseInt(periodId);
        }

        // Lista de estudiantes (orden por grado, sección, nombre)
        let studentQuery, params;
        if (isMassive) {
            studentQuery = `
                SELECT s.id
                FROM students s
                JOIN enrollments e ON s.id = e.student_id
                JOIN \`groups\` grp ON e.group_id = grp.id
                JOIN grades g ON grp.grade_id = g.id
                WHERE e.academic_year_id = ? AND e.deleted_at IS NULL
                GROUP BY s.id
                ORDER BY MIN(CAST(g.name AS UNSIGNED)) ASC,
                         MIN(FIELD(grp.name,'A','B','C','D','E','F','G','H','I','J')) ASC,
                         MIN(s.full_name) ASC`;
            params = [academicYearId];
        } else if (groupId) {
            // Solo una sección (grupo)
            studentQuery = `
                SELECT s.id
                FROM students s
                JOIN enrollments e ON s.id = e.student_id
                WHERE e.group_id = ? AND e.academic_year_id = ? AND e.deleted_at IS NULL
                GROUP BY s.id
                ORDER BY MIN(s.full_name) ASC`;
            params = [parseInt(groupId), academicYearId];
        } else {
            studentQuery = `
                SELECT s.id
                FROM students s
                JOIN enrollments e ON s.id = e.student_id
                JOIN \`groups\` grp ON e.group_id = grp.id
                WHERE grp.grade_id = ? AND e.academic_year_id = ? AND e.deleted_at IS NULL
                GROUP BY s.id
                ORDER BY MIN(FIELD(grp.name,'A','B','C','D','E','F','G','H','I','J')) ASC, MIN(s.full_name) ASC`;
            params = [parseInt(gradeId), academicYearId];
        }
        const [students] = await this.pool.query(studentQuery, params);
        if (students.length === 0) throw new Error('No hay estudiantes para generar reportes');

        // Logo en base64 — se incrusta UNA sola vez en el CSS (no por cada boletín)
        let logoDataUri = '';
        const logoPath = path.join(__dirname, '../../../assets', 'logo-colegio.png');
        if (fs.existsSync(logoPath)) {
            const b64 = fs.readFileSync(logoPath).toString('base64');
            logoDataUri = `data:image/png;base64,${b64}`;
        }

        // Renderizar cada boletín
        const cards = [];
        for (const st of students) {
            cards.push(await this._renderStudent(st.id, academicYearId, academicYear, isFinal, periodId, periodOrder, !!logoDataUri));
        }

        return this._wrap(cards.join('\n'), students.length, logoDataUri);
    }

    async _renderStudent(studentId, academicYearId, academicYear, isFinal, periodId, periodOrder, hasLogo) {
        // Datos del estudiante
        const [srows] = await this.pool.query(
            `SELECT s.full_name, g.name as grade_name, grp.name as group_name
             FROM students s
             JOIN enrollments e ON s.id = e.student_id
             JOIN \`groups\` grp ON e.group_id = grp.id
             JOIN grades g ON grp.grade_id = g.id
             WHERE s.id = ? AND e.academic_year_id = ? AND e.deleted_at IS NULL LIMIT 1`,
            [studentId, academicYearId]
        );
        if (srows.length === 0) return '';
        const student = srows[0];

        // Materias regulares
        let subjects;
        if (isFinal) {
            [subjects] = await this.pool.query(
                `SELECT s.name as subject_name,
                        AVG(CAST(gr.normal_note AS DECIMAL(4,2))) as normal_note,
                        AVG(CAST(gr.aptitudinal_note AS DECIMAL(4,2))) as aptitudinal_note,
                        SUM(gr.absences) as absences
                 FROM grade_records gr
                 JOIN subject_assignments sa ON gr.subject_assignment_id = sa.id
                 JOIN subjects s ON sa.subject_id = s.id
                 JOIN enrollments e ON gr.enrollment_id = e.id
                 WHERE e.student_id = ? AND e.academic_year_id = ?
                   AND (sa.is_elective = 0 OR sa.is_elective IS NULL)
                 GROUP BY s.id, s.name ORDER BY s.name`,
                [studentId, academicYearId]
            );
        } else {
            [subjects] = await this.pool.query(
                `SELECT s.name as subject_name, gr.normal_note, gr.aptitudinal_note, gr.absences
                 FROM grade_records gr
                 JOIN subject_assignments sa ON gr.subject_assignment_id = sa.id
                 JOIN subjects s ON sa.subject_id = s.id
                 JOIN enrollments e ON gr.enrollment_id = e.id
                 WHERE e.student_id = ? AND e.academic_year_id = ? AND gr.period_id = ?
                   AND (sa.is_elective = 0 OR sa.is_elective IS NULL)
                 ORDER BY s.name`,
                [studentId, academicYearId, periodId]
            );
        }

        // Electivas (todas del colegio + notas del estudiante)
        const [allElectives] = await this.pool.query(
            `SELECT DISTINCT s.id, s.name as subject_name
             FROM subjects s JOIN subject_assignments sa ON s.id = sa.subject_id
             WHERE sa.academic_year_id = ? AND sa.is_elective = 1 ORDER BY s.name`,
            [academicYearId]
        );
        let electiveNotes;
        if (isFinal) {
            [electiveNotes] = await this.pool.query(
                `SELECT sa.subject_id, AVG(CAST(gr.normal_note AS DECIMAL(4,2))) as note
                 FROM grade_records gr JOIN subject_assignments sa ON gr.subject_assignment_id = sa.id
                 JOIN enrollments e ON gr.enrollment_id = e.id
                 WHERE e.student_id = ? AND e.academic_year_id = ? AND sa.is_elective = 1
                 GROUP BY sa.subject_id`,
                [studentId, academicYearId]
            );
        } else {
            [electiveNotes] = await this.pool.query(
                `SELECT sa.subject_id, gr.normal_note as note
                 FROM grade_records gr JOIN subject_assignments sa ON gr.subject_assignment_id = sa.id
                 JOIN enrollments e ON gr.enrollment_id = e.id
                 WHERE e.student_id = ? AND e.academic_year_id = ? AND gr.period_id = ? AND sa.is_elective = 1`,
                [studentId, academicYearId, periodId]
            );
        }
        const electiveMap = {};
        electiveNotes.forEach(e => { electiveMap[e.subject_id] = e.note; });

        // Reseña
        let reviewText;
        if (isFinal) {
            const [r] = await this.pool.query(
                `SELECT htr.review FROM head_teacher_reviews htr JOIN periods p ON htr.period_id = p.id
                 WHERE htr.student_id = ? AND htr.academic_year_id = ? AND p.deleted_at IS NULL
                 ORDER BY p.\`order\` DESC LIMIT 1`,
                [studentId, academicYearId]
            );
            reviewText = r[0]?.review || '';
        } else {
            const [r] = await this.pool.query(
                `SELECT review FROM head_teacher_reviews WHERE student_id = ? AND period_id = ? AND academic_year_id = ? LIMIT 1`,
                [studentId, periodId, academicYearId]
            );
            reviewText = r[0]?.review || '';
        }
        if (reviewText.length > MAX_REVIEW_CHARS) reviewText = reviewText.slice(0, MAX_REVIEW_CHARS).trim() + '…';

        // ── Cálculos ──
        let sumN = 0, sumA = 0, cnt = 0;
        const failedCount = subjects.filter(s => s.normal_note !== null && parseFloat(s.normal_note) < 6.5).length;
        const habLabel = failedCount >= 3 ? 'PIERDE AÑO' : 'HABILITA';

        const subjRows = subjects.map(s => {
            const n = fix1(s.normal_note), a = fix1(s.aptitudinal_note);
            const faltas = s.absences !== null && s.absences !== undefined ? String(s.absences) : '0';
            if (n !== '-') { sumN += parseFloat(n); cnt++; }
            if (a !== '-') sumA += parseFloat(a);
            const failed = s.normal_note !== null && parseFloat(s.normal_note) < 6.5;
            const habCell = isFinal ? `<td class="c hab">${failed ? habLabel : ''}</td>` : '';
            return `<tr><td class="b">${esc((s.subject_name || '').toUpperCase())}</td><td class="c">${n}</td><td class="c">${a}</td><td class="c">${faltas}</td>${habCell}</tr>`;
        }).join('');

        const avgN = cnt > 0 ? (sumN / cnt).toFixed(1) : '-';
        const avgA = cnt > 0 ? (sumA / cnt).toFixed(1) : '-';
        const habHeader = isFinal ? '<th>HABILITACION</th>' : '';
        const emptyHab = isFinal ? '<td></td>' : '';

        // Electivas en dos columnas
        const mid = Math.ceil(allElectives.length / 2);
        const left = allElectives.slice(0, mid), right = allElectives.slice(mid);
        let sumE = 0, cntE = 0;
        const noteOf = (subj) => {
            const raw = electiveMap[subj.id];
            const v = fix1(raw);
            if (v !== '-') { sumE += parseFloat(v); cntE++; }
            return v;
        };
        const maxRows = Math.max(left.length, right.length, 1);
        let electiveRows = '';
        for (let i = 0; i < maxRows; i++) {
            const l = left[i], r = right[i];
            const lName = l ? cleanElectiveName(l.subject_name) : '';
            const lNote = l ? noteOf(l) : '';
            const rName = r ? cleanElectiveName(r.subject_name) : '';
            const rNote = r ? noteOf(r) : '';
            electiveRows += `<tr><td class="b">${esc(lName)}</td><td class="c">${l ? lNote : ''}</td><td class="sep"></td><td class="b">${esc(rName)}</td><td class="c">${r ? rNote : ''}</td></tr>`;
        }
        const avgE = cntE > 0 ? (sumE / cntE).toFixed(1) : '-';

        let avgInt = '-';
        if (avgN !== '-' && avgE !== '-') avgInt = ((parseFloat(avgN) + parseFloat(avgE)) / 2).toFixed(1);
        else if (avgN !== '-') avgInt = avgN;
        else if (avgE !== '-') avgInt = avgE;

        const periodoLabel = isFinal ? 'Final' : String(periodOrder);
        const cursoLabel = `${student.grade_name || ''} ${student.group_name || ''}`.trim();

        return `
<div class="report">
  <div class="head">
    <div class="head-logo">${hasLogo ? '<div class="logo"></div>' : ''}</div>
    <div class="head-titles">
      <div class="t1">COLEGIO SAN JOSE DE TARBES</div>
      <div class="t2">INFORME DE CALIFICACIONES</div>
      <div class="t3">Año Lectivo ${esc(academicYear)}</div>
    </div>
  </div>
  <div class="stud">
    <span class="sname">${esc(student.full_name || '')}</span>
    <span class="scurso">${esc(cursoLabel)}</span>
    <span class="speriodo">PERIODO: ${esc(periodoLabel)}</span>
  </div>
  <table class="main">
    <thead><tr><th class="asig">ASIGNATURA</th><th>PROCESO<br>COGNITIVO<br>PROCESUAL</th><th>PROCESO<br>ACTITUDINAL</th><th>ASISTENCIA</th>${habHeader}</tr></thead>
    <tbody>
      ${subjRows}
      <tr class="empty"><td></td><td></td><td></td><td></td>${emptyHab}</tr>
      <tr class="prom"><td class="b">PROMEDIO</td><td class="c">${avgN}</td><td class="c">${avgA}</td><td></td>${emptyHab}</tr>
    </tbody>
  </table>
  <div class="afh">ACTIVIDADES FORMATIVAS (Artísticas, Deportivas y Culturales):</div>
  <table class="elect">
    <tbody>
      ${electiveRows}
      <tr><td colspan="4" class="prom-af">PROMEDIO ACTIVIDADES FORMATIVAS</td><td class="c">${avgE}</td></tr>
    </tbody>
  </table>
  <table class="integral"><tbody><tr><td class="b">PROMEDIO INTEGRAL :</td><td class="c b">${avgInt}</td></tr></tbody></table>
  <div class="ii-label">INFORME INTEGRAL:</div>
  <div class="ii-text">${esc(reviewText)}</div>
  <div class="firma-line">____________________________</div>
  <div class="firma-label">Firma del Director(a) de Grupo</div>
  <div class="foot">
    <span><b>Desempeño Superior: 9.0 a 10.0</b></span>
    <span><b>Desempeño Alto: 7.8 a 8.9</b></span>
    <span><b>Desempeño Básico: 6.5 a 7.7</b></span>
    <span><b>Desempeño Bajo: 1.0 a 6.4</b></span>
  </div>
</div>`;
    }

    _wrap(body, count, logoDataUri) {
        const logoCss = logoDataUri
            ? `.logo { width: 62px; height: 82px; background: url('${logoDataUri}') no-repeat center center; background-size: contain; }`
            : '';
        return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Boletines (${count})</title>
<style>
  /* margin 0 elimina el encabezado (fecha) y pie (URL) que agrega el navegador;
     el margen real de la hoja se aplica como padding de cada boletín */
  @page { size: letter; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, sans-serif; margin: 0; color: #000; }
  .report { page-break-after: always; padding: 2cm; }
  .report:last-child { page-break-after: auto; }

  .head { display: flex; align-items: center; margin-bottom: 6px; }
  .head-logo { width: 90px; text-align: left; }
  ${logoCss}
  .head-titles { flex: 1; text-align: center; }
  .t1 { font-size: 17px; font-weight: bold; }
  .t2 { font-size: 14px; font-weight: bold; margin-top: 2px; }
  .t3 { font-size: 12px; font-weight: bold; margin-top: 2px; }

  .stud { display: flex; justify-content: space-between; font-weight: bold; font-size: 11px; margin: 10px 0 6px; }

  table { border-collapse: collapse; width: 100%; }
  .main, .elect, .integral { border: 1px solid #000; }
  .main th, .main td, .elect td, .integral td { border: 1px solid #000; padding: 3px 6px; font-size: 10px; }
  .main th { text-align: center; font-size: 8px; vertical-align: middle; }
  .main th.asig { font-size: 10px; }
  .main td.b, .elect td.b, .integral td.b { font-weight: bold; text-align: left; }
  .main td.c, .elect td.c, .integral td.c { text-align: center; }
  .main td.hab { font-weight: bold; }
  .main tr.empty td { height: 8px; }
  .main tr.prom td { font-weight: bold; }

  .afh { font-weight: bold; font-size: 10px; margin: 10px 0 4px; }
  .elect td.sep { border: none; width: 12px; }
  .elect td.prom-af { text-align: right; font-weight: bold; }

  .integral { margin-top: 10px; }
  .integral td { font-size: 11px; }
  .integral td.b { width: 85%; }

  .ii-label { font-weight: bold; font-size: 9px; margin: 12px 0 4px; }
  .ii-text { font-size: 9px; line-height: 1.4; min-height: 40px; text-align: justify; }
  .firma-line { margin-top: 26px; font-size: 11px; }
  .firma-label { font-size: 11px; }

  .foot { display: flex; justify-content: space-around; padding-top: 4px; border-top: 1px solid #000; margin-top: 22px; font-size: 8px; white-space: nowrap; }

  @media print { .no-print { display: none; } }
  .no-print { position: fixed; top: 10px; right: 10px; z-index: 999; }
  .no-print button { background: #1d4ed8; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; cursor: pointer; }
</style></head>
<body>
<div class="no-print"><button onclick="window.print()">Imprimir</button></div>
${body}
<script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 400); });</script>
</body></html>`;
    }
}

module.exports = GenerateBulkReportHTML;
