// src/application/use-cases/reports/GenerateExcelList.js
const ExcelJS = require('exceljs');

class GenerateExcelList {
    constructor(studentRepository) {
        this.studentRepository = studentRepository;
    }

    async execute(academicYearId, groupId = null) {
        let students;
        if (groupId) {
            students = await this.studentRepository.getStudentsByGroup(groupId, academicYearId);
        } else {
            students = await this.studentRepository.getAllStudentsWithFolio(academicYearId);
        }

        if (!students || students.length === 0) {
            throw new Error('No hay estudiantes para generar el listado');
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Listado de Estudiantes');
        
        // Estilos del encabezado
        const headerStyle = {
            font: { bold: true, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0a2b4e' } },
            alignment: { horizontal: 'center' }
        };
        
        // Definir columnas
        const columns = [
            { header: '#', key: 'num', width: 8 },
            { header: 'Nombre Completo', key: 'name', width: 40 },
            { header: 'Documento', key: 'document', width: 20 },
            { header: 'Folio', key: 'folio', width: 15 }
        ];
        
        if (!groupId) {
            columns.splice(3, 0, { header: 'Grado - Grupo', key: 'group', width: 20 });
        }
        
        worksheet.columns = columns;
        
        // Aplicar estilo al encabezado
        const headerRow = worksheet.getRow(1);
        headerRow.eachCell(cell => {
            cell.style = headerStyle;
        });
        
        // Agregar datos
        for (let i = 0; i < students.length; i++) {
            const s = students[i];
            const rowData = {
                num: i + 1,
                name: s.full_name,
                document: s.document,
                folio: s.folio_number || '-'
            };
            if (!groupId) {
                rowData.group = `${s.grade_name} - ${s.group_name}`;
            }
            const row = worksheet.addRow(rowData);
            
            // Bordes a cada celda
            row.eachCell(cell => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        }
        
        // Ajustar altura de filas
        worksheet.eachRow(row => {
            row.height = 20;
        });
        
        return await workbook.xlsx.writeBuffer();
    }
}

module.exports = GenerateExcelList;