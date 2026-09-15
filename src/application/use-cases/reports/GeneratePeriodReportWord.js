// src/application/use-cases/reports/GeneratePeriodReportWord.js
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

class GeneratePeriodReportWord {
    constructor(pool) {
        this.pool = pool;
    }

    async execute(studentId, academicYearId, periodId) {
        console.log('=== Generando reporte de período ===');

        // 1. Datos del estudiante
        const [studentRows] = await this.pool.query(
            `SELECT s.id, s.full_name, s.student_code,
                    g.id as grade_id, g.name as grade_name, grp.head_teacher_id,
                    grp.name as group_name,
                    u.name as director_name
             FROM students s
             JOIN enrollments e ON s.id = e.student_id
             JOIN \`groups\` grp ON e.group_id = grp.id
             JOIN grades g ON grp.grade_id = g.id
             LEFT JOIN users u ON grp.head_teacher_id = u.id
             WHERE s.id = ? AND e.academic_year_id = ? AND e.deleted_at IS NULL
             LIMIT 1`,
            [studentId, academicYearId]
        );
        if (studentRows.length === 0) throw new Error('Estudiante no encontrado');
        const student = studentRows[0];
        const directorName = student.director_name || 'Por asignar';
        const studentName = student.full_name || 'No especificado';
        const gradeName = student.grade_name || 'No especificado';

        // 2. Período
        const [periodRows] = await this.pool.query(
            'SELECT `order` FROM periods WHERE id = ? AND deleted_at IS NULL',
            [periodId]
        );
        const periodOrder = periodRows[0]?.order || periodId;
        const periodDisplay = String(periodOrder);

        // 3. Año lectivo
        const [yearRows] = await this.pool.query(
            'SELECT name FROM academic_years WHERE id = ?',
            [academicYearId]
        );
        const academicYear = yearRows[0]?.name || '';

        // 4. Materias regulares
        const [subjectsWithNotes] = await this.pool.query(
            `SELECT s.name as subject_name,
                    gr.normal_note, gr.aptitudinal_note, gr.absences
             FROM grade_records gr
             JOIN subject_assignments sa ON gr.subject_assignment_id = sa.id
             JOIN subjects s ON sa.subject_id = s.id
             JOIN enrollments e ON gr.enrollment_id = e.id
             WHERE e.student_id = ? AND e.academic_year_id = ? AND gr.period_id = ?
               AND (sa.is_elective = 0 OR sa.is_elective IS NULL)
             ORDER BY s.name`,
            [studentId, academicYearId, periodId]
        );

        // 5. Obtener TODAS las materias electivas del colegio (no solo las que tienen nota)
        const [allElectiveSubjects] = await this.pool.query(
            `SELECT DISTINCT s.id, s.name as subject_name
             FROM subjects s
             JOIN subject_assignments sa ON s.id = sa.subject_id
             WHERE sa.academic_year_id = ? AND sa.is_elective = 1
             ORDER BY s.name`,
            [academicYearId]
        );

        // 6. Obtener notas de electivas para este estudiante y período
        const [electiveData] = await this.pool.query(
            `SELECT sa.subject_id, gr.normal_note
             FROM grade_records gr
             JOIN subject_assignments sa ON gr.subject_assignment_id = sa.id
             JOIN enrollments e ON gr.enrollment_id = e.id
             WHERE e.student_id = ? AND e.academic_year_id = ? AND gr.period_id = ?
               AND sa.is_elective = 1`,
            [studentId, academicYearId, periodId]
        );
        
        const electiveNotesMap = {};
        for (const e of electiveData) {
            electiveNotesMap[e.subject_id] = e.normal_note;
        }

        // 7. Reseña del director de grado
        const [reviewRows] = await this.pool.query(
            `SELECT review FROM head_teacher_reviews
             WHERE student_id = ? AND period_id = ? AND academic_year_id = ?
             LIMIT 1`,
            [studentId, periodId, academicYearId]
        );
        // Limitar la reseña para que el informe quepa en una página
        const MAX_REVIEW_CHARS = 600;
        let reviewText = reviewRows[0]?.review || '';
        if (reviewText.length > MAX_REVIEW_CHARS) {
            reviewText = reviewText.slice(0, MAX_REVIEW_CHARS).trim() + '…';
        }

        // ── TABLA PRINCIPAL: ASIGNATURAS ─────────────────────────────────────
        const COL_ASIG = 5912;
        const COL_COG = 1417;
        const COL_ACT = 1276;
        const COL_ASIST = 1134;
        const TABLE_W = COL_ASIG + COL_COG + COL_ACT + COL_ASIST;

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
                    cellBold('ASISTENCIA', COL_ASIST, { center: true, fontSize: 14 }),
                ]
            })
        ];

        let sumNormal = 0, sumAptitudinal = 0, count = 0;

        for (const subj of subjectsWithNotes) {
            const normal = subj.normal_note !== null ? parseFloat(subj.normal_note).toFixed(1) : '-';
            const apt = subj.aptitudinal_note !== null ? parseFloat(subj.aptitudinal_note).toFixed(1) : '-';
            const faltas = subj.absences !== null ? String(subj.absences) : '0';
            
            if (normal !== '-') {
                sumNormal += parseFloat(normal);
                count++;
            }
            if (apt !== '-') {
                sumAptitudinal += parseFloat(apt);
            }

            mainRows.push(new TableRow({
                children: [
                    cellNormal((subj.subject_name || 'Sin nombre').toUpperCase(), COL_ASIG, { bold: true }),
                    cellNormal(normal, COL_COG, { center: true }),
                    cellNormal(apt, COL_ACT, { center: true }),
                    cellNormal(faltas, COL_ASIST, { center: true }),
                ]
            }));
        }

        const avgNormal = count > 0 ? (sumNormal / count).toFixed(1) : '-';
        const avgAptitudinal = count > 0 ? (sumAptitudinal / count).toFixed(1) : '-';

        mainRows.push(new TableRow({
            children: [cellEmpty(COL_ASIG), cellEmpty(COL_COG), cellEmpty(COL_ACT), cellEmpty(COL_ASIST)]
        }));

        mainRows.push(new TableRow({
            children: [
                cellBold('PROMEDIO', COL_ASIG),
                cellNormal(avgNormal, COL_COG, { center: true }),
                cellNormal(avgAptitudinal, COL_ACT, { center: true }),
                cellEmpty(COL_ASIST),
            ]
        }));

        const mainTable = new Table({
            rows: mainRows,
            width: { size: TABLE_W, type: WidthType.DXA },
            columnWidths: [COL_ASIG, COL_COG, COL_ACT, COL_ASIST],
            borders: ALL_BORDERS
        });

        // ── TABLA ACTIVIDADES FORMATIVAS (TODAS las electivas) ─────────────────
        const EC_NAME1 = 3794;
        const EC_NOTE1 = 1134;
        const EC_SEP = 236;
        const EC_NAME2 = 3308;
        const EC_NOTE2 = 1275;
        const ELECT_W = EC_NAME1 + EC_NOTE1 + EC_SEP + EC_NAME2 + EC_NOTE2;

        // Organizar todas las electivas en dos columnas
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
            
            // Limpiar prefijos numéricos (ej: "1 Robotica" -> "ROBOTICA") y unificar en mayúsculas
            const cleanName = (n) => String(n || '').replace(/^\s*\d+\s*/, '').trim().toUpperCase();

            if (left) {
                leftName = cleanName(left.subject_name);
                const note = electiveNotesMap[left.id];
                if (note !== null && note !== undefined && note !== '') {
                    leftNote = parseFloat(note).toFixed(1);
                    sumElective += parseFloat(note);
                    countElective++;
                }
            }

            if (right) {
                rightName = cleanName(right.subject_name);
                const note = electiveNotesMap[right.id];
                if (note !== null && note !== undefined && note !== '') {
                    rightNote = parseFloat(note).toFixed(1);
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

        const avgElective = countElective > 0 ? (sumElective / countElective).toFixed(1) : '-';

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
            avgIntegral = ((parseFloat(avgNormal) + parseFloat(avgElective)) / 2).toFixed(1);
        } else if (avgNormal !== '-') {
            avgIntegral = avgNormal;
        } else if (avgElective !== '-') {
            avgIntegral = avgElective;
        }

        const PI_LABEL = 8330;
        const PI_VAL = 1417;
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
        // Escudo a la izquierda y títulos centrados a su lado (como el formato guía)
        const headerChildren = [];

        const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
        const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };

        const titleParagraphs = [
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 80 },
                children: [new TextRun({ text: 'COLEGIO SAN JOSE DE TARBES', bold: true, size: 34, font: 'Arial' })]
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 60 },
                children: [new TextRun({ text: 'INFORME DE CALIFICACIONES', bold: true, size: 26, font: 'Arial' })]
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 0 },
                children: [new TextRun({ text: 'Año Lectivo ' + academicYear, bold: true, size: 22, font: 'Arial' })]
            }),
        ];

        if (logoImage) {
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
                            children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [logoImage] })]
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

        // Línea del estudiante: nombre, curso y período (sin etiquetas extra, como la guía)
        headerChildren.push(new Paragraph({
            spacing: { before: 120, after: 80 },
            tabStops: [{ type: TabStopType.LEFT, position: 4700 }, { type: TabStopType.LEFT, position: 7200 }],
            children: [
                new TextRun({ text: studentName, bold: true, size: 22, font: 'Arial' }),
                new TextRun({ text: '\t' + gradeName + ' ' + (student.group_name || ''), bold: true, size: 22, font: 'Arial' }),
                new TextRun({ text: '\tPERIODO: ' + periodDisplay, bold: true, size: 22, font: 'Arial' }),
            ]
        }));

        // ── PIE DE PÁGINA ────────────────────────────────────────────────────
        // Pie: 4 columnas iguales, cada rango centrado en la suya. Garantiza un
        // solo renglón, bien distribuido a lo ancho y sin encimarse los textos.
        const footTopBorder = { style: BorderStyle.SINGLE, size: 8, color: '000000' };
        const footNone = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
        const footCell = (text) => new TableCell({
            width: { size: 2493, type: WidthType.DXA },
            borders: { top: footTopBorder, bottom: footNone, left: footNone, right: footNone },
            margins: { top: 60, bottom: 0, left: 40, right: 40 },
            children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text, bold: true, size: 14, font: 'Arial' })]
            })]
        });
        const footerChildren = [
            new Table({
                width: { size: 9972, type: WidthType.DXA },
                columnWidths: [2493, 2493, 2493, 2493],
                rows: [new TableRow({ children: [
                    footCell('Desempeño Superior: 9.0 a 10.0'),
                    footCell('Desempeño Alto: 7.8 a 8.9'),
                    footCell('Desempeño Básico: 6.5 a 7.7'),
                    footCell('Desempeño Bajo: 1.0 a 6.4'),
                ] })]
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
                // Márgenes de 2 cm (1134 DXA) por todos los lados
                properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
                headers: { default: new Header({ children: headerChildren }) },
                footers: { default: new Footer({ children: footerChildren }) },
                children: docChildren,
            }]
        });

        return await Packer.toBuffer(doc);
    }
}

module.exports = GeneratePeriodReportWord;