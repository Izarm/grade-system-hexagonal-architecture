
// src/application/use-cases/reports/GenerateFinalReportExcel.js
const ExcelJS = require('exceljs');

class GenerateFinalReportExcel {
    constructor(pool) {
        this.pool = pool;
    }

    async execute(studentId, academicYearId) {
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
        const [yearRows] = await this.pool.query(
            'SELECT name FROM academic_years WHERE id = ?',
            [academicYearId]
        );
        const academicYear = yearRows[0]?.name || '';

        // 3. Materias regulares
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

        // 4. Obtener TODAS las materias electivas
        const [allElectiveSubjects] = await this.pool.query(
            `SELECT DISTINCT s.id, s.name as subject_name
             FROM subjects s
             JOIN subject_assignments sa ON s.id = sa.subject_id
             WHERE sa.academic_year_id = ? AND sa.is_elective = 1
             ORDER BY s.name`,
            [academicYearId]
        );

        // 5. Obtener promedios de electivas
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
        const reviewText = reviewRows[0]?.review || '_______________________________________________________________________________';

        // 7. Crear libro de Excel
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Boletin_Final');

        // Títulos
        worksheet.mergeCells('A1:E1');
        worksheet.getCell('A1').value = 'COLEGIO SAN JOSE DE TARBES';
        worksheet.getCell('A1').font = { bold: true, size: 16 };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A2:E2');
        worksheet.getCell('A2').value = 'INFORME DE CALIFICACIONES';
        worksheet.getCell('A2').font = { bold: true, size: 14 };
        worksheet.getCell('A2').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A3:E3');
        worksheet.getCell('A3').value = `Año Lectivo ${academicYear}`;
        worksheet.getCell('A3').alignment = { horizontal: 'center' };

        worksheet.addRow([]);
        worksheet.addRow([`NOMBRE ESTUDIANTE: ${studentName}`, `CURSO: ${gradeName}`, '', '', '']);
        worksheet.addRow([`DIRECTOR DE CURSO: ${directorName}`, '', '', '', '']);
        worksheet.addRow([]);

        // Tabla de materias regulares
        worksheet.addRow(['ASIGNATURA', 'PROCESO COGNITIVO', 'PROCESO ACTITUDINAL', 'FALTAS', 'HABILITACION']);
        const regularHeaderRow = worksheet.getRow(worksheet.rowCount);
        regularHeaderRow.eachCell(cell => {
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        });

        let sumNormal = 0, count = 0;

        for (const subj of subjectsWithNotes) {
            const normal = subj.avg_normal !== null ? parseFloat(subj.avg_normal).toFixed(2) : '-';
            const apt = subj.avg_apt !== null ? parseFloat(subj.avg_apt).toFixed(2) : '-';
            const faltas = subj.total_faltas !== null ? subj.total_faltas.toString() : '0';
            
            if (normal !== '-') {
                sumNormal += parseFloat(normal);
                count++;
            }
            
            worksheet.addRow([subj.subject_name || 'Sin nombre', normal, apt, faltas, '-']);
        }

        const avgNormal = count > 0 ? (sumNormal / count).toFixed(2) : '-';
        worksheet.addRow(['PROMEDIO', avgNormal, '', '', '']);
        worksheet.addRow([]);

        // Actividades formativas
        worksheet.addRow(['ACTIVIDADES FORMATIVAS (Artísticas, Deportivas y Culturales):']);
        
        // Encabezado de dos columnas
        worksheet.addRow(['ASIGNATURA', 'NOTA', '', 'ASIGNATURA', 'NOTA']);
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
                const note = electiveAveragesMap[left.id];
                if (note !== '-') {
                    leftNote = note;
                    sumElective += parseFloat(note);
                    countElective++;
                }
            }
            
            if (right) {
                rightName = right.subject_name;
                const note = electiveAveragesMap[right.id];
                if (note !== '-') {
                    rightNote = note;
                    sumElective += parseFloat(note);
                    countElective++;
                }
            }
            
            worksheet.addRow([leftName, leftNote, '', rightName, rightNote]);
        }

        const avgElective = countElective > 0 ? (sumElective / countElective).toFixed(2) : '-';
        worksheet.addRow(['PROMEDIO ACTIVIDADES FORMATIVAS', avgElective, '', '', '']);
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
        worksheet.getColumn(3).width = 5;
        worksheet.getColumn(4).width = 30;
        worksheet.getColumn(5).width = 20;

        return await workbook.xlsx.writeBuffer();
    }
}

module.exports = GenerateFinalReportExcel;