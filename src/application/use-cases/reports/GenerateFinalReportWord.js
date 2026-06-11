// src/application/use-cases/reports/GenerateFinalReportWord.js
const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    WidthType, AlignmentType, BorderStyle, ImageRun, Header, Footer,
    VerticalAlign, TabStopType
} = require('docx');
const fs = require('fs');
const path = require('path');

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const ALL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

function cellBold(text, widthDxa, opts = {}) {
    const { center = false, fontSize = 20 } = opts;
    return new TableCell({
        width: { size: widthDxa, type: WidthType.DXA },
        borders: ALL_BORDERS,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 40, bottom: 40, left: 108, right: 108 },
        children: [new Paragraph({
            alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
            children: [new TextRun({ text: String(text ?? ''), bold: true, size: fontSize, font: 'Arial' })]
        })]
    });
}

function cellNormal(text, widthDxa, opts = {}) {
    const { center = false, bold = false, fontSize = 20 } = opts;
    return new TableCell({
        width: { size: widthDxa, type: WidthType.DXA },
        borders: ALL_BORDERS,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 40, bottom: 40, left: 108, right: 108 },
        children: [new Paragraph({
            alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
            children: [new TextRun({ text: String(text ?? ''), bold, size: fontSize, font: 'Arial' })]
        })]
    });
}

function cellEmpty(widthDxa) {
    return new TableCell({
        width: { size: widthDxa, type: WidthType.DXA },
        borders: ALL_BORDERS,
        margins: { top: 40, bottom: 40, left: 108, right: 108 },
        children: [new Paragraph({ children: [] })]
    });
}

class GenerateFinalReportWord {
    constructor(pool) {
        this.pool = pool;
    }

    async execute(studentId, academicYearId) {
        console.log('=== Generando reporte final ===');

        // 1. Datos del estudiante
        const [studentRows] = await this.pool.query(
            `SELECT s.id, s.full_name, s.student_code,
                    g.id as grade_id, g.name as grade_name, g.head_teacher_id,
                    grp.name as group_name,
                    u.name as director_name
             FROM students s
             JOIN enrollments e ON s.id = e.student_id
             JOIN \`groups\` grp ON e.group_id = grp.id
             JOIN grades g ON grp.grade_id = g.id
             LEFT JOIN users u ON g.head_teacher_id = u.id
             WHERE s.id = ? AND e.academic_year_id = ? AND e.deleted_at IS NULL
             LIMIT 1`,
            [studentId, academicYearId]
        );
        if (studentRows.length === 0) throw new Error('Estudiante no encontrado');
        const student = studentRows[0];
        const directorName = student.director_name || 'Por asignar';
        const studentName = student.full_name || 'No especificado';
        const gradeName = student.grade_name || 'No especificado';

        // 2. Año lectivo
        const [yearRows] = await this.pool.query('SELECT name FROM academic_years WHERE id = ?', [academicYearId]);
        const academicYear = yearRows[0]?.name || '';

        // 3. Materias regulares (promedio de todos los períodos)
        const [subjectsWithNotes] = await this.pool.query(
            `SELECT s.name as subject_name,
                    AVG(CAST(gr.normal_note AS DECIMAL(4,2))) as avg_normal,
                    AVG(CAST(gr.aptitudinal_note AS DECIMAL(4,2))) as avg_apt,
                    SUM(gr.absences) as total_faltas
             FROM grade_records gr
             JOIN subject_assignments sa ON gr.subject_assignment_id = sa.id
             JOIN subjects s ON sa.subject_id = s.id
             JOIN enrollments e ON gr.enrollment_id = e.id
             WHERE e.student_id = ? AND e.academic_year_id = ?
               AND (sa.is_elective = 0 OR sa.is_elective IS NULL)
             GROUP BY s.id, s.name
             ORDER BY s.name`,
            [studentId, academicYearId]
        );

        // 4. Obtener TODAS las materias electivas del colegio
        const [allElectiveSubjects] = await this.pool.query(
            `SELECT DISTINCT s.id, s.name as subject_name
             FROM subjects s
             JOIN subject_assignments sa ON s.id = sa.subject_id
             WHERE sa.academic_year_id = ? AND sa.is_elective = 1
             ORDER BY s.name`,
            [academicYearId]
        );

        // 5. Obtener promedios de electivas para este estudiante
        const [electiveData] = await this.pool.query(
            `SELECT sa.subject_id, AVG(CAST(gr.normal_note AS DECIMAL(4,2))) as avg_normal
             FROM grade_records gr
             JOIN subject_assignments sa ON gr.subject_assignment_id = sa.id
             JOIN enrollments e ON gr.enrollment_id = e.id
             WHERE e.student_id = ? AND e.academic_year_id = ? AND sa.is_elective = 1
             GROUP BY sa.subject_id`,
            [studentId, academicYearId]
        );
        
        const electiveAveragesMap = {};
        for (const e of electiveData) {
            electiveAveragesMap[e.subject_id] = e.avg_normal !== null ? parseFloat(e.avg_normal).toFixed(2) : '-';
        }

        // 6. Reseña del director de grado (último período del año)
        const [reviewRows] = await this.pool.query(
            `SELECT htr.review FROM head_teacher_reviews htr
             JOIN periods p ON htr.period_id = p.id
             WHERE htr.student_id = ? AND htr.academic_year_id = ?
               AND p.deleted_at IS NULL
             ORDER BY p.\`order\` DESC
             LIMIT 1`,
            [studentId, academicYearId]
        );
        const reviewText = reviewRows[0]?.review || '';

        // ── TABLA PRINCIPAL: ASIGNATURAS ─────────────────────────────────────
        const COL_ASIG = 5495;
        const COL_COG = 1134;
        const COL_ACT = 1276;
        const COL_ASIST = 1134;
        const COL_HAB = 1134;
        const TABLE_W = COL_ASIG + COL_COG + COL_ACT + COL_ASIST + COL_HAB;

        const mainRows = [
            new TableRow({
                children: [
                    cellBold('ASIGNATURA', COL_ASIG, { center: true }),
                    new TableCell({
                        width: { size: COL_COG, type: WidthType.DXA },
                        borders: ALL_BORDERS,
                        verticalAlign: VerticalAlign.CENTER,
                        margins: { top: 40, bottom: 40, left: 108, right: 108 },
                        children: [
                            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'PROCESO', bold: true, size: 14, font: 'Arial' })] }),
                            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'COGNITIVO', bold: true, size: 14, font: 'Arial' })] }),
                            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'PROCESUAL', bold: true, size: 14, font: 'Arial' })] }),
                        ]
                    }),
                    new TableCell({
                        width: { size: COL_ACT, type: WidthType.DXA },
                        borders: ALL_BORDERS,
                        verticalAlign: VerticalAlign.CENTER,
                        margins: { top: 40, bottom: 40, left: 108, right: 108 },
                        children: [
                            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'PROCESO', bold: true, size: 14, font: 'Arial' })] }),
                            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ACTITUDINAL', bold: true, size: 14, font: 'Arial' })] }),
                        ]
                    }),
                    cellBold('FALTAS', COL_ASIST, { center: true, fontSize: 14 }),
                    cellBold('HABILITACION', COL_HAB, { center: true, fontSize: 14 }),
                ]
            })
        ];

        let sumNormal = 0, sumAptitudinal = 0, count = 0;

        for (const subj of subjectsWithNotes) {
            const normal = subj.avg_normal !== null ? parseFloat(subj.avg_normal).toFixed(2) : '-';
            const apt = subj.avg_apt !== null ? parseFloat(subj.avg_apt).toFixed(2) : '-';
            const faltas = subj.total_faltas !== null ? `Faltas: ${subj.total_faltas}` : 'Faltas: 0';
            
            if (normal !== '-') {
                sumNormal += parseFloat(normal);
                count++;
            }
            if (apt !== '-') {
                sumAptitudinal += parseFloat(apt);
            }

            mainRows.push(new TableRow({
                children: [
                    cellNormal(subj.subject_name || 'Sin nombre', COL_ASIG, { bold: true }),
                    cellNormal(normal, COL_COG, { center: true }),
                    cellNormal(apt, COL_ACT, { center: true }),
                    cellNormal(faltas, COL_ASIST, { center: true }),
                    cellEmpty(COL_HAB),
                ]
            }));
        }

        const avgNormal = count > 0 ? (sumNormal / count).toFixed(2) : '-';
        const avgAptitudinal = count > 0 ? (sumAptitudinal / count).toFixed(2) : '-';

        mainRows.push(new TableRow({
            children: [cellEmpty(COL_ASIG), cellEmpty(COL_COG), cellEmpty(COL_ACT), cellEmpty(COL_ASIST), cellEmpty(COL_HAB)]
        }));

        mainRows.push(new TableRow({
            children: [
                cellBold('PROMEDIO', COL_ASIG),
                cellNormal(avgNormal, COL_COG, { center: true }),
                cellNormal(avgAptitudinal, COL_ACT, { center: true }),
                cellEmpty(COL_ASIST),
                cellEmpty(COL_HAB),
            ]
        }));

        const mainTable = new Table({
            rows: mainRows,
            width: { size: TABLE_W, type: WidthType.DXA },
            columnWidths: [COL_ASIG, COL_COG, COL_ACT, COL_ASIST, COL_HAB],
            borders: ALL_BORDERS
        });

        // ── TABLA ACTIVIDADES FORMATIVAS (TODAS las electivas) ─────────────────
        const EC_NAME1 = 3227;
        const EC_NOTE1 = 1851;
        const EC_SEP = 236;
        const EC_NAME2 = 3610;
        const EC_NOTE2 = 1249;
        const ELECT_W = EC_NAME1 + EC_NOTE1 + EC_SEP + EC_NAME2 + EC_NOTE2;

        const mid = Math.ceil(allElectiveSubjects.length / 2);
        const leftCol = allElectiveSubjects.slice(0, mid);
        const rightCol = allElectiveSubjects.slice(mid);
        const maxRowsElective = Math.max(leftCol.length, rightCol.length, 1);
        
        const electiveRows = [];
        let sumElective = 0, countElective = 0;

        for (let i = 0; i < maxRowsElective; i++) {
            const left = leftCol[i];
            const right = rightCol[i];
            let leftName = '', leftNote = '-', rightName = '', rightNote = '-';
            
            if (left) {
                leftName = left.subject_name;
                const note = electiveAveragesMap[left.id];
                if (note !== '-' && note !== undefined) {
                    leftNote = note;
                    sumElective += parseFloat(note);
                    countElective++;
                }
            }
            
            if (right) {
                rightName = right.subject_name;
                const note = electiveAveragesMap[right.id];
                if (note !== '-' && note !== undefined) {
                    rightNote = note;
                    sumElective += parseFloat(note);
                    countElective++;
                }
            }
            
            electiveRows.push(new TableRow({
                children: [
                    cellNormal(leftName, EC_NAME1, { bold: true }),
                    cellNormal(leftNote, EC_NOTE1, { center: true }),
                    cellEmpty(EC_SEP),
                    cellNormal(rightName, EC_NAME2, { bold: true }),
                    cellNormal(rightNote, EC_NOTE2, { center: true }),
                ]
            }));
        }

        electiveRows.push(new TableRow({
            children: [cellEmpty(EC_NAME1), cellEmpty(EC_NOTE1), cellEmpty(EC_SEP), cellEmpty(EC_NAME2), cellEmpty(EC_NOTE2)]
        }));

        const avgElective = countElective > 0 ? (sumElective / countElective).toFixed(2) : '-';

        electiveRows.push(new TableRow({
            children: [
                new TableCell({
                    width: { size: EC_NAME1 + EC_NOTE1 + EC_SEP + EC_NAME2, type: WidthType.DXA },
                    columnSpan: 4,
                    borders: ALL_BORDERS,
                    verticalAlign: VerticalAlign.CENTER,
                    margins: { top: 40, bottom: 40, left: 108, right: 108 },
                    children: [new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [new TextRun({ text: 'PROMEDIO ACTIVIDADES FORMATIVAS', bold: true, size: 20, font: 'Arial' })]
                    })]
                }),
                cellNormal(avgElective, EC_NOTE2, { center: true }),
            ]
        }));

        const electiveTable = new Table({
            rows: electiveRows,
            width: { size: ELECT_W, type: WidthType.DXA },
            columnWidths: [EC_NAME1, EC_NOTE1, EC_SEP, EC_NAME2, EC_NOTE2],
            borders: ALL_BORDERS
        });

        // ── PROMEDIO INTEGRAL ───────────────────────────────────────────────
        let avgIntegral = '-';
        if (avgNormal !== '-' && avgElective !== '-') {
            avgIntegral = ((parseFloat(avgNormal) + parseFloat(avgElective)) / 2).toFixed(2);
        } else if (avgNormal !== '-') {
            avgIntegral = avgNormal;
        } else if (avgElective !== '-') {
            avgIntegral = avgElective;
        }

        const PI_LABEL = 8897;
        const PI_VAL = 1276;
        const PI_W = PI_LABEL + PI_VAL;

        const integralTable = new Table({
            width: { size: PI_W, type: WidthType.DXA },
            columnWidths: [PI_LABEL, PI_VAL],
            rows: [
                new TableRow({
                    children: [
                        cellBold('PROMEDIO INTEGRAL :', PI_LABEL, { center: false }),
                        cellBold(avgIntegral, PI_VAL, { center: true }),
                    ]
                })
            ]
        });

        // ── CARGAR LOGO ──────────────────────────────────────────────────────
        const assetDir = path.join(__dirname, '../../../assets');
        let logoImage = null;
        const logoPath = path.join(assetDir, 'logo-colegio.png');
        if (fs.existsSync(logoPath)) {
            try {
                const imageBuffer = fs.readFileSync(logoPath);
                logoImage = new ImageRun({ data: imageBuffer, transformation: { width: 78, height: 104 }, type: 'png' });
            } catch (err) { console.error('Error cargando logo:', err); }
        }

        // ── ENCABEZADO ───────────────────────────────────────────────────────
        const headerChildren = [];

        if (logoImage) {
            headerChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [logoImage] }));
        }

        headerChildren.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [new TextRun({ text: 'COLEGIO SAN JOSE DE TARBES', bold: true, size: 32, font: 'Arial' })]
        }));

        headerChildren.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [new TextRun({ text: 'INFORME DE CALIFICACIONES', bold: true, size: 24, font: 'Arial' })]
        }));

        headerChildren.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [new TextRun({ text: 'Año Lectivo ' + academicYear, bold: true, size: 20, font: 'Arial' })]
        }));

        headerChildren.push(new Paragraph({
            spacing: { after: 60 },
            tabStops: [{ type: TabStopType.LEFT, position: 3600 }, { type: TabStopType.LEFT, position: 6800 }],
            children: [
                new TextRun({ text: 'NOMBRE ESTUDIANTE: ' + studentName, bold: true, size: 22, font: 'Arial' }),
                new TextRun({ text: '\tCURSO: ' + gradeName, bold: true, size: 22, font: 'Arial' }),
                new TextRun({ text: '\tPERIODO FINAL', bold: true, size: 22, font: 'Arial' }),
            ]
        }));

        headerChildren.push(new Paragraph({
            spacing: { after: 60 },
            children: [new TextRun({ text: 'DIRECTOR DE CURSO: ' + directorName, bold: true, size: 16, font: 'Arial' })]
        }));

        // ── PIE DE PÁGINA ────────────────────────────────────────────────────
        const footerChildren = [
            new Paragraph({
                spacing: { before: 60 },
                tabStops: [
                    { type: TabStopType.LEFT, position: 2200 },
                    { type: TabStopType.LEFT, position: 4400 },
                    { type: TabStopType.LEFT, position: 6600 },
                ],
                children: [
                    new TextRun({ text: 'Desempeño Superior: 9.0 a 10.0', bold: true, size: 14, font: 'Arial' }),
                    new TextRun({ text: '\t' }),
                    new TextRun({ text: 'Desempeño Alto: 7.8 a 8.9', bold: true, size: 14, font: 'Arial' }),
                    new TextRun({ text: '\t' }),
                    new TextRun({ text: 'Desempeño Básico: 6.5 a 7.7', bold: true, size: 14, font: 'Arial' }),
                    new TextRun({ text: '\t' }),
                    new TextRun({ text: 'Desempeño Bajo: 1.0 a 6.4', bold: true, size: 14, font: 'Arial' }),
                ]
            })
        ];

        // ── CUERPO DEL DOCUMENTO ────────────────────────────────────────────
        const docChildren = [
            mainTable,
            new Paragraph({ spacing: { before: 160, after: 80 }, children: [] }),
            new Paragraph({
                spacing: { after: 80 },
                children: [new TextRun({ text: 'ACTIVIDADES FORMATIVAS (Artísticas, Deportivas y Culturales):', bold: true, size: 20, font: 'Arial' })]
            }),
            electiveTable,
            new Paragraph({ spacing: { before: 160, after: 80 }, children: [] }),
            integralTable,
            new Paragraph({ spacing: { before: 200, after: 80 }, children: [new TextRun({ text: 'INFORME INTEGRAL:', bold: true, size: 16, font: 'Arial' })] }),
            new Paragraph({ spacing: { after: 200, line: 360, lineRule: 'auto' }, children: [new TextRun({ text: reviewText || '_______________________________________________________________________________', size: 16, font: 'Arial' })] }),
            new Paragraph({ spacing: { after: 60, line: 360, lineRule: 'auto' }, children: [new TextRun({ text: '____________________________', size: 20, font: 'Arial' })] }),
            new Paragraph({ spacing: { after: 0, line: 360, lineRule: 'auto' }, children: [new TextRun({ text: 'Firma del Director(a) de Grupo', size: 20, font: 'Arial' })] }),
        ];

        const doc = new Document({
            sections: [{
                properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 720, bottom: 1080, left: 720 } } },
                headers: { default: new Header({ children: headerChildren }) },
                footers: { default: new Footer({ children: footerChildren }) },
                children: docChildren,
            }]
        });

        return await Packer.toBuffer(doc);
    }
}

module.exports = GenerateFinalReportWord;