// src/application/use-cases/reports/GeneratePeriodReportExcel.js
const ExcelJS = require('exceljs');

class GeneratePeriodReportExcel {
    constructor(pool) {
        this.pool = pool;
    }

    async execute(studentId, academicYearId, periodId) {
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

        // 2. Período
        const [periodRows] = await this.pool.query(
            'SELECT `order` FROM periods WHERE id = ? AND deleted_at IS NULL',
            [periodId]
        );
        const periodOrder = periodRows[0]?.order || periodId;

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

        // 5. Obtener TODAS las materias electivas
        const [allElectiveSubjects] = await this.pool.query(
            `SELECT DISTINCT s.id, s.name as subject_name
             FROM subjects s
             JOIN subject_assignments sa ON s.id = sa.subject_id
             WHERE sa.academic_year_id = ? AND sa.is_elective = 1
             ORDER BY s.name`,
            [academicYearId]
        );

        // 6. Obtener notas de electivas
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
        const reviewText = reviewRows[0]?.review || '_______________________________________________________________________________';

        // 8. Crear libro de Excel
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Boletin');

        // Títulos
        worksheet.mergeCells('A1:D1');
        worksheet.getCell('A1').value = 'COLEGIO SAN JOSE DE TARBES';
        worksheet.getCell('A1').font = { bold: true, size: 16 };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A2:D2');
        worksheet.getCell('A2').value = 'INFORME DE CALIFICACIONES';
        worksheet.getCell('A2').font = { bold: true, size: 14 };
        worksheet.getCell('A2').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A3:D3');
        worksheet.getCell('A3').value = `Año Lectivo ${academicYear}`;
        worksheet.getCell('A3').alignment = { horizontal: 'center' };

        worksheet.addRow([]);
        worksheet.addRow([`NOMBRE ESTUDIANTE: ${studentName}`, `CURSO: ${gradeName}`, `PERIODO: ${periodOrder}`]);
        worksheet.addRow([`DIRECTOR DE CURSO: ${directorName}`]);
        worksheet.addRow([]);

        // Tabla de materias regulares
        worksheet.addRow(['ASIGNATURA', 'PROCESO COGNITIVO', 'PROCESO ACTITUDINAL', 'FALTAS']);
        const regularHeaderRow = worksheet.getRow(worksheet.rowCount);
        regularHeaderRow.eachCell(cell => {
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        });

        let sumNormal = 0, count = 0;

        for (const subj of subjectsWithNotes) {
            const normal = subj.normal_note !== null ? parseFloat(subj.normal_note).toFixed(2) : '-';
            const apt = subj.aptitudinal_note !== null ? parseFloat(subj.aptitudinal_note).toFixed(2) : '-';
            const faltas = subj.absences !== null ? subj.absences.toString() : '0';
            
            if (normal !== '-') {
                sumNormal += parseFloat(normal);
                count++;
            }
            
            worksheet.addRow([subj.subject_name || 'Sin nombre', normal, apt, faltas]);
        }

        const avgNormal = count > 0 ? (sumNormal / count).toFixed(2) : '-';
        worksheet.addRow(['PROMEDIO', avgNormal, '', '']);
        worksheet.addRow([]);

        // Actividades formativas
        worksheet.addRow(['ACTIVIDADES FORMATIVAS (Artísticas, Deportivas y Culturales):']);
        
        // Encabezado de dos columnas
        worksheet.addRow(['ASIGNATURA', 'NOTA', 'ASIGNATURA', 'NOTA']);
        const electiveHeaderRow = worksheet.getRow(worksheet.rowCount);
        electiveHeaderRow.eachCell(cell => {
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        });

        const mid = Math.ceil(allElectiveSubjects.length / 2);
        const leftCol = allElectiveSubjects.slice(0, mid);
        const rightCol = allElectiveSubjects.slice(mid);
        const maxRowsElective = Math.max(leftCol.length, rightCol.length, 1);

        let sumElective = 0, countElective = 0;

        for (let i = 0; i < maxRowsElective; i++) {
            const left = leftCol[i];
            const right = rightCol[i];
            let leftName = '', leftNote = '-', rightName = '', rightNote = '-';
            
            if (left) {
                leftName = left.subject_name;
                const note = electiveNotesMap[left.id];
                if (note !== null && note !== undefined) {
                    leftNote = parseFloat(note).toFixed(2);
                    sumElective += parseFloat(note);
                    countElective++;
                }
            }
            
            if (right) {
                rightName = right.subject_name;
                const note = electiveNotesMap[right.id];
                if (note !== null && note !== undefined) {
                    rightNote = parseFloat(note).toFixed(2);
                    sumElective += parseFloat(note);
                    countElective++;
                }
            }
            
            worksheet.addRow([leftName, leftNote, rightName, rightNote]);
        }

        const avgElective = countElective > 0 ? (sumElective / countElective).toFixed(2) : '-';
        worksheet.addRow(['PROMEDIO ACTIVIDADES FORMATIVAS', avgElective, '', '']);
        worksheet.addRow([]);

        // Promedio integral
        let avgIntegral = '-';
        if (avgNormal !== '-' && avgElective !== '-') {
            avgIntegral = ((parseFloat(avgNormal) + parseFloat(avgElective)) / 2).toFixed(2);
        } else if (avgNormal !== '-') {
            avgIntegral = avgNormal;
        } else if (avgElective !== '-') {
            avgIntegral = avgElective;
        }

        worksheet.addRow(['PROMEDIO INTEGRAL:', avgIntegral]);
        worksheet.addRow([]);
        worksheet.addRow(['INFORME INTEGRAL:']);
        worksheet.addRow([reviewText]);
        worksheet.addRow([]);
        worksheet.addRow(['Firma del Director(a) de Grupo']);

        // Ajustar anchos
        worksheet.getColumn(1).width = 30;
        worksheet.getColumn(2).width = 20;
        worksheet.getColumn(3).width = 20;
        worksheet.getColumn(4).width = 15;

        return await workbook.xlsx.writeBuffer();
    }
}

module.exports = GeneratePeriodReportExcel;