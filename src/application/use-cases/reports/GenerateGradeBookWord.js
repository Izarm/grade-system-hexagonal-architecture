// src/application/use-cases/reports/GenerateGradeBookWord.js
// Libro de Calificaciones: una página por estudiante con todas las
// asignaturas, notas por período, definitiva y faltas del año lectivo.
const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    WidthType, AlignmentType, BorderStyle, ImageRun, Header,
    VerticalAlign, TabStopType, PageBreak
} = require('docx');
const fs = require('fs');
const path = require('path');

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const ALL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };

function cell(text, widthDxa, opts = {}) {
    const { center = false, bold = false, fontSize = 18 } = opts;
    return new TableCell({
        width: { size: widthDxa, type: WidthType.DXA },
        borders: ALL_BORDERS,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 30, bottom: 30, left: 80, right: 80 },
        children: [new Paragraph({
            alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
            children: [new TextRun({ text: String(text ?? ''), bold, size: fontSize, font: 'Arial' })]
        })]
    });
}

class GenerateGradeBookWord {
    constructor(pool) {
        this.pool = pool;
    }

    async execute(gradeId, academicYearId, resolution, resolutionDate, groupId = null) {
        // 1. Datos básicos
        const [[gradeRow]] = await this.pool.query(
            `SELECT name FROM grades WHERE id = ? AND deleted_at IS NULL`, [gradeId]);
        if (!gradeRow) throw new Error('Grado no encontrado');

        const [[yearRow]] = await this.pool.query(
            `SELECT name FROM academic_years WHERE id = ?`, [academicYearId]);
        const academicYear = yearRow?.name || '';

        // 2. Grupos: una sección específica o todas las del grado
        const [groups] = groupId
            ? await this.pool.query(`SELECT id, name FROM \`groups\` WHERE id = ? AND deleted_at IS NULL`, [groupId])
            : await this.pool.query(`SELECT id, name FROM \`groups\` WHERE grade_id = ? AND deleted_at IS NULL`, [gradeId]);
        if (groups.length === 0) throw new Error('El grado no tiene grupos');
        const groupIds = groups.map(g => g.id);
        const groupNameById = Object.fromEntries(groups.map(g => [g.id, g.name]));

        // 3. Períodos del año (ordenados)
        const [periods] = await this.pool.query(
            `SELECT id, name, \`order\` FROM periods
             WHERE academic_year_id = ? AND deleted_at IS NULL
             ORDER BY \`order\` ASC`, [academicYearId]);
        if (periods.length === 0) throw new Error('El año lectivo no tiene períodos');

        // 4. Asignaturas regulares del grado (con intensidad horaria)
        const [subjects] = await this.pool.query(
            `SELECT s.id, s.name, MAX(sa.weekly_hours) as weekly_hours
             FROM subject_assignments sa
             JOIN subjects s ON sa.subject_id = s.id
             WHERE sa.group_id IN (?) AND sa.academic_year_id = ?
               AND (sa.is_elective = 0 OR sa.is_elective IS NULL) AND sa.deleted_at IS NULL
             GROUP BY s.id, s.name
             ORDER BY s.name`,
            [groupIds, academicYearId]);

        // 5. Estudiantes del grado (todas las secciones, orden alfabético por grupo)
        const [students] = await this.pool.query(
            `SELECT e.id as enrollment_id, e.group_id, e.folio_number,
                    s.id as student_id, s.full_name, s.student_code
             FROM enrollments e
             JOIN students s ON e.student_id = s.id
             WHERE e.group_id IN (?) AND e.academic_year_id = ? AND e.deleted_at IS NULL
             ORDER BY e.group_id, s.full_name`,
            [groupIds, academicYearId]);
        if (students.length === 0) throw new Error('El grado no tiene estudiantes matriculados');

        // 6. Todas las notas del año para esos estudiantes (materias regulares)
        const enrollmentIds = students.map(st => st.enrollment_id);
        const [records] = await this.pool.query(
            `SELECT gr.enrollment_id, gr.period_id, gr.normal_note, gr.absences, sa.subject_id
             FROM grade_records gr
             JOIN subject_assignments sa ON gr.subject_assignment_id = sa.id
             WHERE gr.enrollment_id IN (?)
               AND (sa.is_elective = 0 OR sa.is_elective IS NULL)
               AND gr.deleted_at IS NULL`,
            [enrollmentIds]);

        // Mapa: enrollment → subject → period → nota / faltas
        const noteMap = {};
        for (const r of records) {
            const key = `${r.enrollment_id}_${r.subject_id}`;
            if (!noteMap[key]) noteMap[key] = { notes: {}, faltas: 0 };
            if (r.normal_note !== null && r.normal_note !== '') {
                noteMap[key].notes[r.period_id] = parseFloat(r.normal_note);
            }
            noteMap[key].faltas += r.absences || 0;
        }

        // ── LOGO ────────────────────────────────────────────────────────────
        const assetDir = path.join(__dirname, '../../../assets');
        const logoPath = path.join(assetDir, 'logo-colegio.png');
        let logoBuffer = null;
        if (fs.existsSync(logoPath)) {
            try { logoBuffer = fs.readFileSync(logoPath); } catch (e) { /* sin logo */ }
        }

        // ── ENCABEZADO (se repite en cada página) ───────────────────────────
        const titleParagraphs = [
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 80 },
                children: [new TextRun({ text: 'COLEGIO SAN JOSE DE TARBES', bold: true, size: 34, font: 'Arial' })]
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 60 },
                children: [new TextRun({ text: 'LIBRO DE CALIFICACIONES', bold: true, size: 26, font: 'Arial' })]
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 0 },
                children: [new TextRun({ text: 'Año Lectivo ' + academicYear, bold: true, size: 22, font: 'Arial' })]
            }),
        ];

        const headerChildren = [];
        if (logoBuffer) {
            headerChildren.push(new Table({
                width: { size: 9740, type: WidthType.DXA },
                columnWidths: [1500, 8240],
                borders: NO_BORDERS,
                rows: [new TableRow({
                    children: [
                        new TableCell({
                            width: { size: 1500, type: WidthType.DXA },
                            borders: NO_BORDERS,
                            verticalAlign: VerticalAlign.CENTER,
                            children: [new Paragraph({
                                alignment: AlignmentType.LEFT,
                                children: [new ImageRun({ data: logoBuffer, transformation: { width: 78, height: 104 }, type: 'png' })]
                            })]
                        }),
                        new TableCell({
                            width: { size: 8240, type: WidthType.DXA },
                            borders: NO_BORDERS,
                            verticalAlign: VerticalAlign.CENTER,
                            children: titleParagraphs
                        }),
                    ]
                })]
            }));
        } else {
            headerChildren.push(...titleParagraphs);
        }

        // ── ANCHOS DE LA TABLA DE NOTAS ─────────────────────────────────────
        const nPeriods = periods.length;
        const COL_HS = 600;
        const COL_P = 800;
        const COL_DEF = 900;
        const COL_FALTA = 800;
        const COL_ASIG = 9740 - COL_HS - (COL_P * nPeriods) - COL_DEF - COL_FALTA;
        const columnWidths = [COL_ASIG, COL_HS, ...Array(nPeriods).fill(COL_P), COL_DEF, COL_FALTA];
        const TABLE_W = columnWidths.reduce((a, b) => a + b, 0);

        // ── UNA PÁGINA POR ESTUDIANTE ───────────────────────────────────────
        const docChildren = [];
        let listNumber = 0;
        let lastGroupId = null;

        for (const st of students) {
            // El número de lista se reinicia por sección
            if (st.group_id !== lastGroupId) { listNumber = 0; lastGroupId = st.group_id; }
            listNumber++;

            const folio = st.folio_number || listNumber;
            const groupName = groupNameById[st.group_id] || '';

            // Datos del estudiante
            docChildren.push(new Paragraph({
                spacing: { before: 120, after: 60 },
                children: [
                    new TextRun({ text: 'Alumno : ', bold: true, size: 22, font: 'Arial' }),
                    new TextRun({ text: (st.full_name || '').toUpperCase(), bold: true, size: 22, font: 'Arial' }),
                ]
            }));
            docChildren.push(new Paragraph({
                spacing: { after: 60 },
                tabStops: [
                    { type: TabStopType.LEFT, position: 3200 },
                    { type: TabStopType.LEFT, position: 6200 },
                ],
                children: [
                    new TextRun({ text: 'Curso : ' + gradeRow.name + ' ' + groupName, bold: true, size: 20, font: 'Arial' }),
                    new TextRun({ text: '\tJornada : DIURNA', bold: true, size: 20, font: 'Arial' }),
                    new TextRun({ text: '\tNúmero de Lista : ' + listNumber, bold: true, size: 20, font: 'Arial' }),
                ]
            }));
            docChildren.push(new Paragraph({
                spacing: { after: 120 },
                tabStops: [
                    { type: TabStopType.LEFT, position: 3800 },
                    { type: TabStopType.LEFT, position: 7400 },
                ],
                children: [
                    new TextRun({ text: 'Resolución : ' + (resolution || ''), bold: true, size: 20, font: 'Arial' }),
                    new TextRun({ text: '\tFecha Resolución : ' + (resolutionDate || ''), bold: true, size: 20, font: 'Arial' }),
                    new TextRun({ text: '\tFolio : ' + folio, bold: true, size: 20, font: 'Arial' }),
                ]
            }));

            // Tabla de notas
            const headerCells = [
                cell('AREAS Y ASIGNATURAS', COL_ASIG, { bold: true, center: true }),
                cell('HS', COL_HS, { bold: true, center: true }),
                ...periods.map((p, i) => cell('P' + (i + 1), COL_P, { bold: true, center: true })),
                cell('DEFIN.', COL_DEF, { bold: true, center: true }),
                cell('FALTAS', COL_FALTA, { bold: true, center: true, fontSize: 14 }),
            ];
            const rows = [new TableRow({ children: headerCells })];

            for (const subj of subjects) {
                const data = noteMap[`${st.enrollment_id}_${subj.id}`] || { notes: {}, faltas: 0 };
                const periodNotes = periods.map(p => data.notes[p.id]);
                const validNotes = periodNotes.filter(n => n !== undefined && n !== null && !isNaN(n));
                const defin = validNotes.length > 0
                    ? (validNotes.reduce((a, b) => a + b, 0) / validNotes.length).toFixed(1)
                    : '-';

                rows.push(new TableRow({
                    children: [
                        cell((subj.name || '').toUpperCase(), COL_ASIG, { bold: false }),
                        cell(subj.weekly_hours != null ? subj.weekly_hours : '-', COL_HS, { center: true }),
                        ...periodNotes.map(n => cell(n !== undefined && n !== null ? n.toFixed(1) : '-', COL_P, { center: true })),
                        cell(defin, COL_DEF, { center: true, bold: true }),
                        cell(String(data.faltas || 0), COL_FALTA, { center: true }),
                    ]
                }));
            }

            docChildren.push(new Table({
                rows,
                width: { size: TABLE_W, type: WidthType.DXA },
                columnWidths,
                borders: ALL_BORDERS
            }));

            // APROBO / APLAZO
            docChildren.push(new Paragraph({
                spacing: { before: 240, after: 160 },
                tabStops: [{ type: TabStopType.LEFT, position: 3600 }],
                children: [
                    new TextRun({ text: 'APROBO :  ______________', bold: true, size: 20, font: 'Arial' }),
                    new TextRun({ text: '\tAPLAZO :  ______________', bold: true, size: 20, font: 'Arial' }),
                ]
            }));

            // OBSERVACIONES
            docChildren.push(new Paragraph({
                spacing: { after: 100 },
                children: [new TextRun({ text: 'OBSERVACIONES :', bold: true, size: 20, font: 'Arial' })]
            }));
            for (let i = 0; i < 4; i++) {
                docChildren.push(new Paragraph({
                    spacing: { after: 100 },
                    children: [new TextRun({ text: '_'.repeat(95), size: 18, font: 'Arial' })]
                }));
            }

            // Firmas
            docChildren.push(new Paragraph({
                spacing: { before: 500, after: 40 },
                tabStops: [{ type: TabStopType.LEFT, position: 5200 }],
                children: [
                    new TextRun({ text: '________________________', size: 20, font: 'Arial' }),
                    new TextRun({ text: '\t________________________', size: 20, font: 'Arial' }),
                ]
            }));
            docChildren.push(new Paragraph({
                spacing: { after: 0 },
                tabStops: [{ type: TabStopType.LEFT, position: 5200 }],
                children: [
                    new TextRun({ text: 'RECTOR', bold: true, size: 20, font: 'Arial' }),
                    new TextRun({ text: '\tSECRETARIA', bold: true, size: 20, font: 'Arial' }),
                ]
            }));

            // Salto de página entre estudiantes (excepto el último)
            if (st !== students[students.length - 1]) {
                docChildren.push(new Paragraph({ children: [new PageBreak()] }));
            }
        }

        const doc = new Document({
            sections: [{
                properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
                headers: { default: new Header({ children: headerChildren }) },
                children: docChildren,
            }]
        });

        return await Packer.toBuffer(doc);
    }
}

module.exports = GenerateGradeBookWord;
