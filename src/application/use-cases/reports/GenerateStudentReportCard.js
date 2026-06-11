// src/application/use-cases/reports/GenerateStudentReportCard.js
const PDFDocument = require('pdfkit');

class GenerateStudentReportCard {
    constructor(studentRepository) {
        this.studentRepository = studentRepository;
    }

    async execute(studentId, academicYearId) {
        // Obtener información del estudiante
        const student = await this.studentRepository.findById(studentId);
        if (!student) throw new Error('Estudiante no encontrado');

        // Obtener matrícula
        const enrollment = await this.studentRepository.findEnrollmentsByStudent(studentId, academicYearId);
        if (!enrollment) throw new Error('Estudiante no matriculado en este año lectivo');

        // Obtener notas
        const grades = await this.studentRepository.getStudentGradesForReport(studentId, academicYearId);

        // Organizar notas por período
        const periods = {};
        grades.forEach(g => {
            if (!periods[g.period_name]) {
                periods[g.period_name] = { period_order: g.period_order, subjects: [] };
            }
            periods[g.period_name].subjects.push({
                name: g.subject_name,
                area: g.area,
                normal: g.normal_note,
                aptitudinal: g.aptitudinal_note,
                average: g.average
            });
        });

        // Ordenar períodos
        const sortedPeriods = Object.keys(periods).sort((a, b) => periods[a].period_order - periods[b].period_order);

        // Crear el PDF
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));

        return new Promise((resolve, reject) => {
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(chunks);
                resolve(pdfBuffer);
            });
            doc.on('error', reject);

            // Encabezado
            doc.fontSize(20).font('Helvetica-Bold').text('Colegio San José de Tarbes', { align: 'center' });
            doc.fontSize(14).font('Helvetica').text('Boletín Académico', { align: 'center' });
            doc.moveDown();

            doc.fontSize(12).font('Helvetica-Bold').text('Datos del Estudiante');
            doc.fontSize(10).font('Helvetica');
            doc.text(`Nombre: ${student.full_name}`);
            doc.text(`Documento: ${student.document}`);
            if (student.birth_date) doc.text(`Fecha de nacimiento: ${student.birth_date}`);
            doc.text(`Grado: ${enrollment.grade_name} - Grupo: ${enrollment.group_name}`);
            doc.text(`Año Lectivo: ${academicYearId}`);
            doc.moveDown();

            // Tabla de notas por período
            for (const periodName of sortedPeriods) {
                doc.fontSize(12).font('Helvetica-Bold').text(periodName, { underline: true });
                doc.moveDown(0.5);

                const startX = doc.x;
                const colWidths = [150, 80, 80, 80];
                doc.fontSize(9).font('Helvetica-Bold');
                doc.text('Asignatura', startX);
                doc.text('Nota Normal', startX + colWidths[0]);
                doc.text('Nota Actitudinal', startX + colWidths[0] + colWidths[1]);
                doc.text('Promedio', startX + colWidths[0] + colWidths[1] + colWidths[2]);
                doc.moveDown(0.5);

                doc.fontSize(9).font('Helvetica');
                for (const subject of periods[periodName].subjects) {
                    const avg = subject.average !== null ? subject.average.toFixed(2) : '-';
                    const normalStr = subject.normal !== null ? subject.normal.toFixed(2) : '-';
                    const aptitudinalStr = subject.aptitudinal !== null ? subject.aptitudinal.toFixed(2) : '-';

                    doc.text(subject.name, startX);
                    doc.text(normalStr, startX + colWidths[0]);
                    doc.text(aptitudinalStr, startX + colWidths[0] + colWidths[1]);

                    if (subject.average !== null) {
                        if (subject.average >= 9.0) doc.fillColor('#0ea5e9');       // Superior
                        else if (subject.average >= 7.8) doc.fillColor('#10b981'); // Alto
                        else if (subject.average >= 6.5) doc.fillColor('#f59e0b'); // Básico
                        else doc.fillColor('#ef4444');                              // Bajo
                    }
                    doc.text(avg, startX + colWidths[0] + colWidths[1] + colWidths[2]);
                    doc.fillColor('black');
                    doc.moveDown(0.3);
                }
                doc.moveDown();
            }

            // Promedio general
            let sumAverages = 0;
            let count = 0;
            for (const periodName of sortedPeriods) {
                for (const subject of periods[periodName].subjects) {
                    if (subject.average !== null) {
                        sumAverages += subject.average;
                        count++;
                    }
                }
            }
            const overallAvg = count > 0 ? (sumAverages / count).toFixed(2) : '-';
            doc.fontSize(12).font('Helvetica-Bold');
            doc.text(`Promedio General: ${overallAvg}`, { align: 'right' });

            doc.moveDown(2);
            doc.fontSize(8).font('Helvetica');
            doc.text('Documento generado por el Sistema de Gestión Académica - Colegio San José de Tarbes', { align: 'center' });

            doc.end();
        });
    }
}

module.exports = GenerateStudentReportCard;