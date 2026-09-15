// src/application/use-cases/reports/GenerateEnrollmentCardWord.js
// Tarjeta Acumulativa de Matrícula: histórico completo de matrículas de un
// estudiante. Usa el mismo encabezado institucional que los boletines.
const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    WidthType, AlignmentType, BorderStyle, ImageRun, Header,
    VerticalAlign
} = require('docx');
const fs = require('fs');
const path = require('path');

const BORDER     = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const ALL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const NO_BORDER  = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };

// MySQL devuelve las columnas DATE como objetos Date; formatear en local
// (no con toISOString, que puede correr el día por la zona horaria).
const fmtDate = (d) => {
    if (!d) return '';
    if (d instanceof Date) {
        const p = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }
    return String(d).slice(0, 10);
};

function labelCell(text, width) {
    return new TableCell({
        width: { size: width, type: WidthType.DXA },
        borders: NO_BORDERS,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 40, bottom: 40, left: 60, right: 60 },
        children: [new Paragraph({
            children: [new TextRun({ text, bold: true, size: 18, font: 'Arial' })]
        })]
    });
}

// Valor con borde inferior, como los campos rellenables de la tarjeta física
function valueCell(text, width) {
    return new TableCell({
        width: { size: width, type: WidthType.DXA },
        borders: { top: NO_BORDER, bottom: BORDER, left: NO_BORDER, right: NO_BORDER },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 40, bottom: 40, left: 60, right: 60 },
        children: [new Paragraph({
            children: [new TextRun({ text: String(text ?? ''), size: 18, font: 'Arial' })]
        })]
    });
}

function gridCell(text, width, opts = {}) {
    const { bold = false, center = false, size = 18 } = opts;
    return new TableCell({
        width: { size: width, type: WidthType.DXA },
        borders: ALL_BORDERS,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 40, bottom: 40, left: 80, right: 80 },
        children: [new Paragraph({
            alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
            children: [new TextRun({ text: String(text ?? ''), bold, size, font: 'Arial' })]
        })]
    });
}

class GenerateEnrollmentCardWord {
    constructor(pool) {
        this.pool = pool;
    }

    async execute(studentCode) {
        // 1. Ficha del estudiante
        const [[student]] = await this.pool.query(
            `SELECT id, full_name, student_code, birth_date, phone_landline,
                    phone_mobile1, address, guardian, admission_date,
                    document_issue_date, document_issue_place,
                    withdrawal_date, withdrawal_reason, observations
             FROM students
             WHERE student_code = ? AND deleted_at IS NULL
             LIMIT 1`,
            [studentCode]
        );
        if (!student) throw new Error('Estudiante no encontrado');

        // 2. Historial completo (archivo histórico + matrículas vivas)
        const [history] = await this.pool.query(
            `SELECT academic_year, grade_name, group_name FROM (
                SELECT student_code, grade_name, group_name, academic_year
                FROM enrollment_history
                UNION ALL
                SELECT s.student_code, g.name, grp.name, CAST(ay.name AS UNSIGNED)
                FROM enrollments e
                JOIN students s        ON e.student_id = s.id
                JOIN \`groups\` grp     ON e.group_id = grp.id
                JOIN grades g          ON COALESCE(e.grade_id, grp.grade_id) = g.id
                JOIN academic_years ay ON e.academic_year_id = ay.id
                WHERE e.deleted_at IS NULL
             ) h
             WHERE student_code = ?
             ORDER BY academic_year DESC`,
            [studentCode]
        );

        const birthYear = student.birth_date
            ? new Date(student.birth_date).getFullYear()
            : null;

        // ── LOGO ────────────────────────────────────────────────────────────
        const logoPath = path.join(__dirname, '../../../assets', 'logo-colegio.png');
        let logoBuffer = null;
        if (fs.existsSync(logoPath)) {
            try { logoBuffer = fs.readFileSync(logoPath); } catch (e) { /* sin logo */ }
        }

        // ── ENCABEZADO INSTITUCIONAL (mismo estilo que los boletines) ───────
        const titleParagraphs = [
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 80 },
                children: [new TextRun({ text: 'COLEGIO SAN JOSE DE TARBES', bold: true, size: 34, font: 'Arial' })]
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 0 },
                children: [new TextRun({ text: 'Tarjeta Acumulativa de Matrícula', bold: true, size: 24, font: 'Arial' })]
            }),
        ];

        const headerChildren = [];
        if (logoBuffer) {
            headerChildren.push(new Table({
                width: { size: 9740, type: WidthType.DXA },
                columnWidths: [1500, 6740, 1500],
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
                            width: { size: 6740, type: WidthType.DXA },
                            borders: NO_BORDERS,
                            verticalAlign: VerticalAlign.CENTER,
                            children: titleParagraphs
                        }),
                        new TableCell({
                            width: { size: 1500, type: WidthType.DXA },
                            borders: NO_BORDERS,
                            verticalAlign: VerticalAlign.CENTER,
                            children: [
                                new Paragraph({
                                    alignment: AlignmentType.RIGHT,
                                    children: [new TextRun({ text: 'Código', size: 16, font: 'Arial', color: '666666' })]
                                }),
                                new Paragraph({
                                    alignment: AlignmentType.RIGHT,
                                    children: [new TextRun({ text: student.student_code || '', bold: true, size: 22, font: 'Arial' })]
                                }),
                            ]
                        }),
                    ]
                })]
            }));
        } else {
            headerChildren.push(...titleParagraphs);
        }

        // ── DATOS DEL ESTUDIANTE ────────────────────────────────────────────
        const L = 1900, V = 2970; // ancho etiqueta / valor
        const infoRow = (l1, v1, l2, v2) => new TableRow({
            children: [labelCell(l1, L), valueCell(v1, V), labelCell(l2, L), valueCell(v2, V)]
        });

        const infoTable = new Table({
            width: { size: L * 2 + V * 2, type: WidthType.DXA },
            columnWidths: [L, V, L, V],
            borders: NO_BORDERS,
            rows: [
                infoRow('Nombre completo', student.full_name, 'Fecha de nacimiento', fmtDate(student.birth_date)),
                infoRow('Teléfono fijo', student.phone_landline, 'Celular del padre', student.phone_mobile1),
                infoRow('Residencia', student.address, 'Fecha de ingreso', fmtDate(student.admission_date)),
                infoRow('Expedición del documento', fmtDate(student.document_issue_date), 'Lugar de expedición', student.document_issue_place),
                infoRow('Padres o acudientes', student.guardian, 'Colegio de procedencia', ''),
            ]
        });

        // ── TABLA DE MATRÍCULAS ─────────────────────────────────────────────
        const C_ANIO = 1600, C_EDAD = 1200, C_GRADO = 4200, C_CURSO = 1740;
        const rows = [new TableRow({
            children: [
                gridCell('Año lectivo', C_ANIO, { bold: true, center: true }),
                gridCell('Edad', C_EDAD, { bold: true, center: true }),
                gridCell('Grado', C_GRADO, { bold: true }),
                gridCell('Curso', C_CURSO, { bold: true, center: true }),
            ]
        })];

        for (const h of history) {
            const edad = birthYear ? (Number(h.academic_year) - birthYear) : '';
            rows.push(new TableRow({
                children: [
                    gridCell(h.academic_year, C_ANIO, { center: true }),
                    gridCell(edad, C_EDAD, { center: true }),
                    gridCell((h.grade_name || '').toUpperCase(), C_GRADO),
                    gridCell(h.group_name || '', C_CURSO, { center: true }),
                ]
            }));
        }
        if (history.length === 0) {
            rows.push(new TableRow({
                children: [
                    new TableCell({
                        columnSpan: 4,
                        borders: ALL_BORDERS,
                        margins: { top: 80, bottom: 80, left: 80, right: 80 },
                        children: [new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [new TextRun({ text: 'Sin matrículas registradas', size: 18, font: 'Arial', color: '888888' })]
                        })]
                    })
                ]
            }));
        }

        const historyTable = new Table({
            rows,
            width: { size: C_ANIO + C_EDAD + C_GRADO + C_CURSO, type: WidthType.DXA },
            columnWidths: [C_ANIO, C_EDAD, C_GRADO, C_CURSO],
            borders: ALL_BORDERS
        });

        // ── RETIRO / OBSERVACIONES ──────────────────────────────────────────
        const W_FULL = C_ANIO + C_EDAD + C_GRADO + C_CURSO;
        const boxRow = (label, value, lines = 1) => new TableRow({
            children: [
                new TableCell({
                    width: { size: 2400, type: WidthType.DXA },
                    borders: NO_BORDERS,
                    margins: { top: 60, bottom: 60, left: 100, right: 60 },
                    children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18, font: 'Arial' })] })]
                }),
                new TableCell({
                    width: { size: W_FULL - 2400, type: WidthType.DXA },
                    borders: NO_BORDERS,
                    margins: { top: 60, bottom: 60, left: 60, right: 100 },
                    children: value
                        ? [new Paragraph({ children: [new TextRun({ text: String(value), size: 18, font: 'Arial' })] })]
                        : Array.from({ length: lines }, () => new Paragraph({
                            children: [new TextRun({ text: '_'.repeat(70), size: 16, font: 'Arial', color: 'AAAAAA' })]
                        })),
                }),
            ]
        });

        const closingTable = new Table({
            width: { size: W_FULL, type: WidthType.DXA },
            columnWidths: [2400, W_FULL - 2400],
            borders: ALL_BORDERS,
            rows: [
                boxRow('Fecha de retiro', fmtDate(student.withdrawal_date)),
                boxRow('Motivo', student.withdrawal_reason),
                boxRow('Observaciones', student.observations, 3),
            ]
        });

        // ── DOCUMENTO ───────────────────────────────────────────────────────
        const docChildren = [
            new Paragraph({ spacing: { before: 120, after: 80 }, children: [] }),
            infoTable,
            new Paragraph({ spacing: { before: 240, after: 100 }, children: [
                new TextRun({ text: 'HISTORIAL DE MATRÍCULAS', bold: true, size: 20, font: 'Arial' })
            ] }),
            historyTable,
            new Paragraph({ spacing: { before: 260, after: 80 }, children: [] }),
            closingTable,
        ];

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

module.exports = GenerateEnrollmentCardWord;
