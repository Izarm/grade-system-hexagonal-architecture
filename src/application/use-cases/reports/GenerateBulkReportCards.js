const PDFDocument = require('pdfkit');
const archiver = require('archiver');
const stream = require('stream');

const FONT_REGULAR = 'C:\\Windows\\Fonts\\Arial.ttf';
const FONT_BOLD    = 'C:\\Windows\\Fonts\\arialbd.ttf';

class GenerateBulkReportCards {
    constructor(studentRepository) {
        this.studentRepository = studentRepository;
    }

    async execute(academicYearId, gradeId = null, groupId = null) {
        // Obtener estudiantes según el filtro
        let students;
        if (groupId) {
            students = await this.studentRepository.getStudentsByGroup(groupId, academicYearId);
        } else if (gradeId) {
            students = await this.studentRepository.getStudentsByGrade(gradeId, academicYearId);
        } else {
            throw new Error('Debe especificar grado o grupo');
        }

        if (!students || students.length === 0) {
            throw new Error('No hay estudiantes para generar boletines');
        }

        // Generar PDFs primero, luego crear ZIP
        const pdfFiles = [];
        for (const student of students) {
            const pdfBuffer = await this.generateSingleReportCard(student.id, academicYearId);
            const fileName = `${(student.full_name || `estudiante_${student.id}`).replace(/[^a-zA-Z0-9]/g, '_')}_boletin.pdf`;
            pdfFiles.push({ buffer: pdfBuffer, name: fileName });
        }

        return new Promise((resolve, reject) => {
            const archive = archiver('zip', { zlib: { level: 6 } });
            const chunks = [];
            archive.on('data', chunk => chunks.push(chunk));
            archive.on('end', () => resolve(Buffer.concat(chunks)));
            archive.on('error', reject);

            for (const f of pdfFiles) {
                archive.append(f.buffer, { name: f.name });
            }
            archive.finalize();
        });
    }

    async generateSingleReportCard(studentId, academicYearId) {
        const GenerateStudentReportCard = require('./GenerateStudentReportCard');
        const gen = new GenerateStudentReportCard(this.studentRepository);
        return gen.execute(studentId, academicYearId);
    }

    buildPDF(doc, student, enrollment, sortedPeriods, periods, academicYearId) {
        const L = 50;
        const W = doc.page.width - 100;
        const COL = [L, L + 200, L + 290, L + 375];
        const colW = [200, 85, 80, W - 375];

        // Encabezado
        doc.font(FONT_BOLD).fontSize(18).text('Colegio San José de Tarbes', L, 50, { width: W, align: 'center' });
        doc.font(FONT_REGULAR).fontSize(13).text('Boletín Académico', L, doc.y + 4, { width: W, align: 'center' });
        doc.moveDown(1);

        doc.font(FONT_BOLD).fontSize(10).text('Datos del Estudiante', L, doc.y);
        doc.moveDown(0.4);
        doc.font(FONT_REGULAR).fontSize(10);
        doc.text(`Nombre: ${student.full_name || ''}`);
        doc.text(`Código: ${student.student_code || ''}`);
        doc.text(`Grado: ${enrollment.grade_name || ''} — Grupo: ${enrollment.group_name || ''}`);
        doc.text(`Año lectivo: ${enrollment.academic_year_name || academicYearId}`);
        doc.moveDown(1);

        const drawHeader = (y) => {
            doc.rect(L, y, W, 16).fill('#1d4ed8');
            doc.font(FONT_BOLD).fontSize(8).fillColor('white');
            doc.text('Asignatura',     COL[0]+3, y+4, { width: colW[0]-6 });
            doc.text('Nota regular',   COL[1]+3, y+4, { width: colW[1]-6, align: 'center' });
            doc.text('Actitudinal',    COL[2]+3, y+4, { width: colW[2]-6, align: 'center' });
            doc.text('Promedio',       COL[3]+3, y+4, { width: colW[3]-6, align: 'center' });
            doc.fillColor('black');
        };

        let sumAll = 0, cntAll = 0;

        for (const periodName of sortedPeriods) {
            if (doc.y > doc.page.height - 150) doc.addPage();
            doc.font(FONT_BOLD).fontSize(11).text(periodName, L, doc.y, { underline: true });
            doc.moveDown(0.3);
            const hY = doc.y;
            drawHeader(hY);
            let rowY = hY + 18;
            let odd = true;
            for (const subject of periods[periodName].subjects) {
                if (rowY > doc.page.height - 80) { doc.addPage(); drawHeader(50); rowY = 68; odd = true; }
                doc.rect(L, rowY, W, 14).fill(odd ? '#f1f5f9' : '#ffffff');
                odd = !odd;
                const avgVal  = subject.average !== null ? parseFloat(subject.average) : null;
                const normVal = subject.normal  !== null ? parseFloat(subject.normal)  : null;
                const aptVal  = subject.aptitudinal !== null ? parseFloat(subject.aptitudinal) : null;
                const avgStr  = avgVal  !== null ? avgVal.toFixed(2)  : '-';
                const normStr = normVal !== null ? normVal.toFixed(2) : '-';
                const aptStr  = aptVal  !== null ? aptVal.toFixed(2)  : '-';
                let avgColor = '#1e293b';
                if (avgVal !== null) {
                    if (avgVal >= 9.0) avgColor = '#0284c7';
                    else if (avgVal >= 7.8) avgColor = '#16a34a';
                    else if (avgVal >= 6.5) avgColor = '#d97706';
                    else avgColor = '#dc2626';
                    sumAll += avgVal; cntAll++;
                }
                doc.font(FONT_REGULAR).fontSize(8).fillColor('#1e293b');
                doc.text(subject.name||'', COL[0]+3, rowY+3, { width: colW[0]-6 });
                doc.text(normStr,          COL[1]+3, rowY+3, { width: colW[1]-6, align: 'center' });
                doc.text(aptStr,           COL[2]+3, rowY+3, { width: colW[2]-6, align: 'center' });
                doc.fillColor(avgColor);
                doc.text(avgStr,           COL[3]+3, rowY+3, { width: colW[3]-6, align: 'center' });
                doc.fillColor('#1e293b');
                rowY += 14;
            }
            doc.y = rowY + 6;
            doc.moveDown(0.5);
        }

        const overallAvg = cntAll > 0 ? (sumAll / cntAll).toFixed(2) : '-';
        doc.font(FONT_BOLD).fontSize(11).text(`Promedio general del año: ${overallAvg}`, 50, doc.y, { width: doc.page.width - 100, align: 'right' });
        doc.moveDown(2);
        doc.font(FONT_REGULAR).fontSize(7).text('Documento generado por el Sistema de Gestión Académica — Colegio San José de Tarbes', 50, doc.y, { width: doc.page.width - 100, align: 'center' });
    }
}

module.exports = GenerateBulkReportCards;