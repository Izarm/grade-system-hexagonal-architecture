const PDFDocument = require('pdfkit');
const path = require('path');

const FONT_REGULAR = 'C:\\Windows\\Fonts\\Arial.ttf';
const FONT_BOLD    = 'C:\\Windows\\Fonts\\arialbd.ttf';

class GenerateStudentReportCard {
    constructor(studentRepository) {
        this.studentRepository = studentRepository;
    }

    async execute(studentId, academicYearId) {
        const student = await this.studentRepository.findById(studentId);
        if (!student) throw new Error('Estudiante no encontrado');

        const enrollment = await this.studentRepository.findEnrollmentsByStudent(studentId, academicYearId);
        if (!enrollment) throw new Error('Estudiante no matriculado en este año lectivo');

        const grades = await this.studentRepository.getStudentGradesForReport(studentId, academicYearId);

        const periods = {};
        grades.forEach(g => {
            if (!periods[g.period_name]) {
                periods[g.period_name] = { period_order: g.period_order, subjects: [] };
            }
            periods[g.period_name].subjects.push({
                name: g.subject_name,
                isElective: g.is_elective,
                normal: g.normal_note != null ? parseFloat(g.normal_note) : null,
                aptitudinal: g.aptitudinal_note != null ? parseFloat(g.aptitudinal_note) : null,
                average: g.average != null ? parseFloat(g.average) : null
            });
        });

        const sortedPeriods = Object.keys(periods).sort((a, b) => periods[a].period_order - periods[b].period_order);

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));

        return new Promise((resolve, reject) => {
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            const L = 50;  // left margin
            const W = doc.page.width - 100;  // usable width

            // Encabezado
            doc.font(FONT_BOLD).fontSize(18).text('Colegio San José de Tarbes', L, 50, { width: W, align: 'center' });
            doc.font(FONT_REGULAR).fontSize(13).text('Boletín Académico', L, doc.y + 4, { width: W, align: 'center' });
            doc.moveDown(1);

            // Datos del estudiante
            const sy = doc.y;
            doc.font(FONT_BOLD).fontSize(10).text('Datos del Estudiante', L, sy);
            doc.moveDown(0.4);
            doc.font(FONT_REGULAR).fontSize(10);
            doc.text(`Nombre: ${student.full_name || ''}`);
            doc.text(`Código: ${student.student_code || ''}`);
            doc.text(`Grado: ${enrollment.grade_name || ''} — Grupo: ${enrollment.group_name || ''}`);
            doc.text(`Año lectivo: ${enrollment.academic_year_name || academicYearId}`);
            if (enrollment.head_teacher_name) doc.text(`Director de grupo: ${enrollment.head_teacher_name}`);
            doc.moveDown(1);

            // Columnas
            const COL = [L, L + 200, L + 290, L + 375, L + 460];
            const colW = [200, 80, 80, 80, W - 460];

            const drawTableHeader = (y) => {
                doc.font(FONT_BOLD).fontSize(8);
                doc.rect(L, y, W, 16).fill('#1d4ed8');
                doc.fillColor('white');
                doc.text('Asignatura',     COL[0] + 3, y + 3, { width: colW[0] - 6 });
                doc.text('Nota regular',   COL[1] + 3, y + 3, { width: colW[1] - 6, align: 'center' });
                doc.text('Actitudinal',    COL[2] + 3, y + 3, { width: colW[2] - 6, align: 'center' });
                doc.text('Promedio',       COL[3] + 3, y + 3, { width: colW[3] - 6, align: 'center' });
                doc.fillColor('black');
            };

            let sumAll = 0, cntAll = 0;

            for (const periodName of sortedPeriods) {
                // Asegurar espacio suficiente para encabezado + al menos 2 filas
                if (doc.y > doc.page.height - 150) doc.addPage();

                doc.font(FONT_BOLD).fontSize(11).text(periodName, L, doc.y, { underline: true });
                doc.moveDown(0.4);

                const headerY = doc.y;
                drawTableHeader(headerY);
                let rowY = headerY + 18;
                let odd = true;

                const nonElective = periods[periodName].subjects.filter(s => !s.isElective);
                const elective    = periods[periodName].subjects.filter(s =>  s.isElective);
                const allSubs = [...nonElective, ...elective];

                for (const sub of allSubs) {
                    if (rowY > doc.page.height - 80) {
                        doc.addPage();
                        drawTableHeader(50);
                        rowY = 68;
                        odd = true;
                    }

                    const bg = odd ? '#f1f5f9' : '#ffffff';
                    doc.rect(L, rowY, W, 14).fill(bg);
                    odd = !odd;

                    const avgVal = sub.average;
                    let avgColor = '#1e293b';
                    if (avgVal !== null) {
                        if (avgVal >= 9.0) avgColor = '#0284c7';
                        else if (avgVal >= 7.8) avgColor = '#16a34a';
                        else if (avgVal >= 6.5) avgColor = '#d97706';
                        else avgColor = '#dc2626';
                        sumAll += avgVal; cntAll++;
                    }

                    const avgStr  = avgVal !== null ? avgVal.toFixed(2) : '-';
                    const normStr = sub.normal !== null ? sub.normal.toFixed(2) : '-';
                    const aptStr  = sub.aptitudinal !== null ? sub.aptitudinal.toFixed(2) : '-';
                    const subjLabel = sub.isElective ? `${sub.name} (electiva)` : sub.name;

                    doc.font(FONT_REGULAR).fontSize(8).fillColor('#1e293b');
                    doc.text(subjLabel, COL[0] + 3, rowY + 3, { width: colW[0] - 6 });
                    doc.text(normStr,   COL[1] + 3, rowY + 3, { width: colW[1] - 6, align: 'center' });
                    doc.text(aptStr,    COL[2] + 3, rowY + 3, { width: colW[2] - 6, align: 'center' });
                    doc.fillColor(avgColor);
                    doc.text(avgStr,    COL[3] + 3, rowY + 3, { width: colW[3] - 6, align: 'center' });
                    doc.fillColor('#1e293b');
                    rowY += 14;
                }
                doc.y = rowY + 6;
                doc.moveDown(0.5);
            }

            // Promedio general
            const overallAvg = cntAll > 0 ? (sumAll / cntAll).toFixed(2) : '-';
            const overallColor = parseFloat(overallAvg) >= 6.0 ? '#16a34a' : '#dc2626';
            doc.moveDown(0.5);
            doc.font(FONT_BOLD).fontSize(11).fillColor('#1e293b');
            doc.text(`Promedio general del año: `, L, doc.y, { continued: true });
            doc.fillColor(overallColor).text(overallAvg, { align: 'left' });
            doc.fillColor('#1e293b');

            doc.moveDown(2);
            doc.font(FONT_REGULAR).fontSize(7)
               .text('Documento generado por el Sistema de Gestión Académica — Colegio San José de Tarbes',
                     L, doc.y, { width: W, align: 'center' });
            doc.end();
        });
    }
}

module.exports = GenerateStudentReportCard;
