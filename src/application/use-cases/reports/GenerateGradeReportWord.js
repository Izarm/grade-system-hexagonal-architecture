const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        WidthType, AlignmentType, BorderStyle, VerticalAlign } = require('docx');

const BORDER  = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

const cell = (text, w, { bold = false, center = false, sz = 16, color } = {}) =>
    new TableCell({
        width: { size: w, type: WidthType.DXA },
        borders: BORDERS,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 30, bottom: 30, left: 72, right: 72 },
        children: [new Paragraph({
            alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
            children: [new TextRun({ text: String(text ?? '-'), bold, size: sz, font: 'Arial', color })]
        })]
    });

function parseNote(raw) {
    if (raw === null || raw === undefined || raw === '') return null;
    if (typeof raw === 'string' && raw.includes(',')) {
        const parts = raw.split(',').map(n => parseFloat(n.trim())).filter(n => !isNaN(n));
        return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
    }
    const v = parseFloat(raw);
    return isNaN(v) ? null : v;
}

function getStatus(studentId, subjects, notesMap) {
    const failed = subjects.filter(s => {
        const note = parseNote(notesMap[studentId]?.[s.subject_id]);
        return note !== null && note < 6.5;
    });
    if (failed.length >= 3) return 'PIERDE AÑO';
    if (failed.length >= 1) return 'HABILITA';
    return '';
}

class GenerateGradeReportWord {
    constructor(pool) { this.pool = pool; }

    async execute({ academicYearId, periodId, gradeId, groupId }) {
        const [[period]]   = await this.pool.query(`SELECT id, name, \`order\` FROM periods WHERE id = ? AND deleted_at IS NULL`, [periodId]);
        if (!period) throw new Error('Período no encontrado');
        const [[yearRow]]  = await this.pool.query(`SELECT name FROM academic_years WHERE id = ?`, [academicYearId]);
        const [[gradeRow]] = await this.pool.query(`SELECT name FROM grades WHERE id = ? AND deleted_at IS NULL`, [gradeId]);

        // Si se indica una sección (grupo), el reporte es solo de esa sección;
        // si no, incluye todas las secciones del grado.
        const [groups] = groupId
            ? await this.pool.query(`SELECT id, name, head_teacher_id FROM \`groups\` WHERE id = ? AND deleted_at IS NULL`, [groupId])
            : await this.pool.query(`SELECT id, name, head_teacher_id FROM \`groups\` WHERE grade_id = ? AND deleted_at IS NULL`, [gradeId]);
        const groupIds = groups.map(g => g.id);
        if (!groupIds.length) throw new Error('Sin grupos para el grado');

        // Director: si es una sección puntual, el director de esa sección;
        // si es el grado completo, el director de la primera sección con director asignado.
        const htIds = groups.map(g => g.head_teacher_id).filter(Boolean);
        let htRow = null;
        if (htIds.length) {
            const [htRows] = await this.pool.query(`SELECT name AS ht FROM users WHERE id = ? LIMIT 1`, [htIds[0]]);
            htRow = htRows[0] || null;
        }

        const [subjects] = await this.pool.query(
            `SELECT DISTINCT sa.id, s.id as subject_id, s.name
             FROM subject_assignments sa JOIN subjects s ON sa.subject_id = s.id
             WHERE sa.group_id IN (?) AND sa.academic_year_id = ? AND sa.is_elective = 0 AND sa.deleted_at IS NULL
             ORDER BY s.name`, [groupIds, academicYearId]);

        const [students] = await this.pool.query(
            `SELECT e.id as enrollment_id, e.student_id, e.folio_number, s.full_name, s.student_code
             FROM enrollments e JOIN students s ON e.student_id = s.id
             WHERE e.group_id IN (?) AND e.academic_year_id = ? AND e.deleted_at IS NULL
             ORDER BY e.folio_number, s.full_name`, [groupIds, academicYearId]);

        const studentIds = students.map(s => s.student_id);
        let notesMap = {};
        if (studentIds.length && subjects.length) {
            const [rows] = await this.pool.query(
                `SELECT gr.normal_note, e.student_id, sa.subject_id
                 FROM grade_records gr
                 JOIN enrollments e ON gr.enrollment_id = e.id
                 JOIN subject_assignments sa ON gr.subject_assignment_id = sa.id
                 WHERE e.student_id IN (?) AND gr.period_id = ? AND gr.deleted_at IS NULL`,
                [studentIds, periodId]);
            rows.forEach(r => {
                if (!notesMap[r.student_id]) notesMap[r.student_id] = {};
                notesMap[r.student_id][r.subject_id] = r.normal_note;
            });
        }

        const isFinalPeriod = period.name && period.name.toLowerCase().includes('final');

        // ─── Anchos de columna ───────────────────────────────────────────────
        const PAGE_W  = 10800;
        const W_CODE  = 800;
        const W_NAME  = 2800;
        const W_AVG   = 700;
        const W_STATUS = isFinalPeriod ? 1200 : 0;
        const subjectCount = subjects.length || 1;
        const W_SUBJ  = Math.max(500, Math.floor((PAGE_W - W_CODE - W_NAME - W_AVG - W_STATUS) / subjectCount));

        // ─── Fila de encabezado ──────────────────────────────────────────────
        const headerCells = [
            cell('Cód.',      W_CODE, { bold: true, center: true, sz: 14 }),
            cell('Estudiante', W_NAME, { bold: true, sz: 14 }),
            ...subjects.map(s => cell(s.name, W_SUBJ, { bold: true, center: true, sz: 12 })),
            cell('Prom.', W_AVG, { bold: true, center: true, sz: 14 }),
        ];
        if (isFinalPeriod) headerCells.push(cell('Estado', W_STATUS, { bold: true, center: true, sz: 14 }));
        const headerRow = new TableRow({ children: headerCells });

        // ─── Filas de estudiantes ────────────────────────────────────────────
        const subjectSums   = new Array(subjects.length).fill(0);
        const subjectCounts = new Array(subjects.length).fill(0);
        const studentAvgs   = [];

        const dataRows = students.map(st => {
            let sum = 0, cnt = 0;
            const noteCells = subjects.map((subj, i) => {
                const val = parseNote(notesMap[st.student_id]?.[subj.subject_id]);
                if (val !== null) {
                    sum += val; cnt++;
                    subjectSums[i] += val; subjectCounts[i]++;
                    return cell(val.toFixed(1), W_SUBJ, { center: true });
                }
                return cell('-', W_SUBJ, { center: true });
            });
            const avg = cnt ? (sum / cnt) : null;
            if (avg !== null) studentAvgs.push(avg);

            const rowCells = [
                cell(st.student_code || st.folio_number || '-', W_CODE, { center: true }),
                cell(st.full_name, W_NAME),
                ...noteCells,
                cell(avg ? avg.toFixed(1) : '-', W_AVG, { center: true }),
            ];

            if (isFinalPeriod) {
                const status = getStatus(st.student_id, subjects, notesMap);
                const statusColor = status === 'PIERDE AÑO' ? 'CC0000' : status === 'HABILITA' ? '996600' : '000000';
                rowCells.push(cell(status, W_STATUS, { center: true, bold: status !== '', color: statusColor }));
            }

            return new TableRow({ children: rowCells });
        });

        // ─── Fila de promedios ───────────────────────────────────────────────
        const overallAvg = studentAvgs.length ? (studentAvgs.reduce((a,b)=>a+b,0)/studentAvgs.length).toFixed(1) : '-';
        const avgCells = [
            cell('PROM.', W_CODE, { bold: true, center: true, sz: 14 }),
            cell('',      W_NAME),
            ...subjects.map((_,i) => cell(subjectCounts[i] ? (subjectSums[i]/subjectCounts[i]).toFixed(1) : '-', W_SUBJ, { bold: true, center: true })),
            cell(overallAvg, W_AVG, { bold: true, center: true }),
        ];
        if (isFinalPeriod) avgCells.push(cell('', W_STATUS));
        const avgRow = new TableRow({ children: avgCells });

        const table = new Table({
            rows: [headerRow, ...dataRows, avgRow],
            width: { size: PAGE_W, type: WidthType.DXA },
        });

        // ─── Documento ───────────────────────────────────────────────────────
        const doc = new Document({ sections: [{
            properties: { page: { size: { width: 15840, height: 12240 }, margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
            children: [
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'COLEGIO SAN JOSE DE TARBES', bold: true, size: 28, font: 'Arial' })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: 'INFORME NOTAS PROCESO COGNITIVO', bold: true, size: 22, font: 'Arial' })] }),
                new Paragraph({ spacing: { after: 40 }, children: [
                    new TextRun({ text: `Año lectivo: ${yearRow?.name || ''}   ·   Período: ${period.order} - ${period.name}   ·   Grado: ${gradeRow?.name || ''}${groups.length ? ' ' + groups.map(g => g.name).join(', ') : ''}   ·   Director: ${htRow?.ht || 'No asignado'}`, size: 18, font: 'Arial' })
                ]}),
                table,
                new Paragraph({ spacing: { before: 200 }, children: [
                    new TextRun({ text: 'Superior ≥ 9.0   Alto ≥ 7.8   Básico ≥ 6.5   Bajo < 6.5', size: 14, font: 'Arial' })
                ]}),
            ]
        }]});

        return await Packer.toBuffer(doc);
    }
}

module.exports = GenerateGradeReportWord;
