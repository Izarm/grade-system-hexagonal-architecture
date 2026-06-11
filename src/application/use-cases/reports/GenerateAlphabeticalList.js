const PDFDocument = require('pdfkit');

class GenerateAlphabeticalList {
    constructor(studentRepository) {
        this.studentRepository = studentRepository;
    }

    async execute(academicYearId, groupId = null, format = 'pdf') {
        let students;
        if (groupId) {
            students = await this.studentRepository.getStudentsByGroup(groupId, academicYearId);
        } else {
            students = await this.studentRepository.getAllStudentsWithFolio(academicYearId);
        }

        if (!students || students.length === 0) {
            throw new Error('No hay estudiantes para generar el listado');
        }

        if (format === 'pdf') {
            return await this.generatePDF(students, academicYearId, groupId);
        } else {
            return await this.generateExcel(students, academicYearId, groupId);
        }
    }

    async generatePDF(students, academicYearId, groupId) {
        const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        
        return new Promise((resolve, reject) => {
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(chunks);
                resolve(pdfBuffer);
            });
            doc.on('error', reject);

            // Encabezado
            doc.fontSize(18).font('Helvetica-Bold').text('Colegio San José de Tarbes', { align: 'center' });
            doc.fontSize(14).text('Listado Alfabético de Estudiantes', { align: 'center' });
            doc.fontSize(10).text(`Año Lectivo: ${academicYearId}`, { align: 'center' });
            if (groupId) {
                doc.text(`Grupo: ${groupId}`, { align: 'center' });
            }
            doc.moveDown();
            
            doc.text(`Fecha de generación: ${new Date().toLocaleDateString()}`, { align: 'right' });
            doc.moveDown();

            // Tabla
            const startX = doc.x;
            const colWidths = [40, 250, 120, 120, 80];
            
            // Cabecera
            doc.fontSize(9).font('Helvetica-Bold');
            doc.text('#', startX);
            doc.text('Nombre Completo', startX + colWidths[0]);
            doc.text('Documento', startX + colWidths[0] + colWidths[1]);
            if (!groupId) {
                doc.text('Grado - Grupo', startX + colWidths[0] + colWidths[1] + colWidths[2]);
            }
            doc.text('Folio', startX + colWidths[0] + colWidths[1] + colWidths[2] + (groupId ? colWidths[3] : colWidths[3]));
            doc.moveDown(0.5);
            
            let yPos = doc.y;
            let count = 0;
            doc.fontSize(9).font('Helvetica');
            
            for (let i = 0; i < students.length; i++) {
                const s = students[i];
                const num = (i + 1).toString();
                count++;
                
                doc.text(num, startX);
                doc.text(s.full_name, startX + colWidths[0]);
                doc.text(s.document, startX + colWidths[0] + colWidths[1]);
                if (!groupId) {
                    doc.text(`${s.grade_name} - ${s.group_name}`, startX + colWidths[0] + colWidths[1] + colWidths[2]);
                }
                doc.text(s.folio_number || '-', startX + colWidths[0] + colWidths[1] + colWidths[2] + (groupId ? colWidths[3] : colWidths[3]));
                doc.moveDown(0.3);
                
                // Salto de página si es necesario
                if (doc.y > 700 && i < students.length - 1) {
                    doc.addPage();
                    // Re-encabezado en nueva página
                    doc.fontSize(9).font('Helvetica-Bold');
                    doc.text('#', startX);
                    doc.text('Nombre Completo', startX + colWidths[0]);
                    doc.text('Documento', startX + colWidths[0] + colWidths[1]);
                    if (!groupId) {
                        doc.text('Grado - Grupo', startX + colWidths[0] + colWidths[1] + colWidths[2]);
                    }
                    doc.text('Folio', startX + colWidths[0] + colWidths[1] + colWidths[2] + (groupId ? colWidths[3] : colWidths[3]));
                    doc.moveDown(0.5);
                    doc.fontSize(9).font('Helvetica');
                }
            }
            
            doc.moveDown();
            doc.fontSize(9).font('Helvetica');
            doc.text(`Total de estudiantes: ${count}`, { align: 'left' });
            doc.moveDown();
            doc.text('Documento generado por el Sistema de Gestión Académica - Colegio San José de Tarbes', { align: 'center' });
            
            doc.end();
        });
    }

    async generateExcel(students, academicYearId, groupId) {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Listado de Estudiantes');
        
        // Estilos
        const headerStyle = {
            font: { bold: true, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0a2b4e' } }
        };
        
        // Columnas
        worksheet.columns = [
            { header: '#', key: 'num', width: 8 },
            { header: 'Nombre Completo', key: 'name', width: 40 },
            { header: 'Documento', key: 'document', width: 20 },
            { header: 'Folio', key: 'folio', width: 15 }
        ];
        
        if (!groupId) {
            worksheet.spliceColumns(4, 0, { header: 'Grado - Grupo', key: 'group', width: 20 });
        }
        
        // Aplicar estilo al encabezado
        worksheet.getRow(1).eachCell(cell => {
            cell.style = headerStyle;
        });
        
        // Agregar datos
        for (let i = 0; i < students.length; i++) {
            const s = students[i];
            const row = {
                num: i + 1,
                name: s.full_name,
                document: s.document,
                folio: s.folio_number || '-'
            };
            if (!groupId) {
                row.group = `${s.grade_name} - ${s.group_name}`;
            }
            worksheet.addRow(row);
        }
        
        // Bordes
        worksheet.eachRow(row => {
            row.eachCell(cell => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });
        });
        
        const buffer = await workbook.xlsx.writeBuffer();
        return buffer;
    }
}

module.exports = GenerateAlphabeticalList;