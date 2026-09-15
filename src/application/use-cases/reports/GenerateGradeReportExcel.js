// src/application/use-cases/reports/GenerateGradeReportExcel.js
const ExcelJS = require('exceljs');

class GenerateGradeReportExcel {
    constructor(pool) {
        this.pool = pool;
    }

    async execute({ academicYearId, periodId, gradeId, groupId }) {
        // 1. Obtener datos del período
        const [periodRows] = await this.pool.query(
            `SELECT id, name, \`order\`, academic_year_id
             FROM periods
             WHERE id = ? AND deleted_at IS NULL`,
            [periodId]
        );
        const period = periodRows[0];
        if (!period) throw new Error('Período no encontrado');

        // 2. Obtener año lectivo
        const [yearRows] = await this.pool.query(
            `SELECT id, name FROM academic_years WHERE id = ? AND deleted_at IS NULL`,
            [academicYearId]
        );
        const academicYear = yearRows[0];

        // 3. Obtener grado
        const [gradeRows] = await this.pool.query(
            `SELECT id, name FROM grades WHERE id = ? AND deleted_at IS NULL`,
            [gradeId]
        );
        const grade = gradeRows[0];

        // 4. Obtener grupos del grado
        let groups = [];
        if (groupId) {
            const [groupRows] = await this.pool.query(
                `SELECT id, name, grade_id, head_teacher_id FROM \`groups\` WHERE id = ? AND deleted_at IS NULL`,
                [groupId]
            );
            groups = groupRows;
        } else {
            const [groupRows] = await this.pool.query(
                `SELECT id, name, grade_id, head_teacher_id FROM \`groups\` WHERE grade_id = ? AND deleted_at IS NULL`,
                [gradeId]
            );
            groups = groupRows;
        }

        // 5. Obtener director de grado (de la sección; el director se asigna por grupo)
        let headTeacherName = 'No asignado';
        const htIds = groups.map(g => g.head_teacher_id).filter(Boolean);
        if (htIds.length) {
            const [htRows] = await this.pool.query(`SELECT name FROM users WHERE id = ? LIMIT 1`, [htIds[0]]);
            headTeacherName = htRows[0]?.name || 'No asignado';
        }

        // 6. Obtener materias asignadas al grado
        const groupIds = groups.map(g => g.id);
        let subjects = [];

        if (groupIds.length > 0) {
            const [subjectRows] = await this.pool.query(
                `SELECT DISTINCT sa.id, s.id as subject_id, s.name as subject_name, sa.is_elective
                 FROM subject_assignments sa
                 JOIN subjects s ON sa.subject_id = s.id
                 WHERE sa.group_id IN (?)
                   AND sa.academic_year_id = ?
                   AND sa.is_elective = 0
                   AND sa.deleted_at IS NULL
                 ORDER BY s.name`,
                [groupIds, academicYearId]
            );
            subjects = subjectRows;
        }

        // 7. Obtener estudiantes matriculados
        let students = [];
        if (groupIds.length > 0) {
            const [studentRows] = await this.pool.query(
                `SELECT DISTINCT e.id as enrollment_id, e.student_id, e.folio_number,
                        s.full_name, s.student_code,
                        g.name as grade_name, grp.name as group_name
                 FROM enrollments e
                 JOIN students s ON e.student_id = s.id
                 JOIN \`groups\` grp ON e.group_id = grp.id
                 JOIN grades g ON grp.grade_id = g.id
                 WHERE e.group_id IN (?)
                   AND e.academic_year_id = ?
                   AND e.deleted_at IS NULL
                 ORDER BY g.name, e.folio_number ASC, s.full_name ASC`,
                [groupIds, academicYearId]
            );
            students = studentRows;
        }

        // 8. Obtener notas de cada estudiante
        const studentIds = students.map(s => s.student_id);
        let gradesMap = {};

        if (studentIds.length > 0 && subjects.length > 0) {
            const [gradeRows] = await this.pool.query(
                `SELECT gr.*, e.student_id, sa.subject_id
                 FROM grade_records gr
                 JOIN enrollments e ON gr.enrollment_id = e.id
                 JOIN subject_assignments sa ON gr.subject_assignment_id = sa.id
                 WHERE e.student_id IN (?)
                   AND gr.period_id = ?
                   AND gr.deleted_at IS NULL`,
                [studentIds, periodId]
            );

            gradeRows.forEach(g => {
                if (!gradesMap[g.student_id]) {
                    gradesMap[g.student_id] = {};
                }
                gradesMap[g.student_id][g.subject_id] = {
                    normal_note: g.normal_note,
                    aptitudinal_note: g.aptitudinal_note,
                    average: g.average,
                    absences: g.absences
                };
            });
        }

        // 9. Generar Excel
        const buffer = await this.generateExcel({
            period,
            academicYear,
            grade,
            groups,
            headTeacherName,
            subjects,
            students,
            gradesMap
        });

        return buffer;
    }

    _parseNote(noteValue) {
        if (!noteValue) return null;
        if (typeof noteValue === 'string' && noteValue.includes(',')) {
            const notes = noteValue.split(',').map(n => parseFloat(n.trim()));
            const valid = notes.filter(n => !isNaN(n));
            return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
        }
        const parsed = parseFloat(noteValue);
        return isNaN(parsed) ? null : parsed;
    }

    _getStudentStatus(studentId, subjects, gradesMap) {
        const failedSubjects = [];
        for (const subject of subjects) {
            const grade = gradesMap[studentId]?.[subject.subject_id];
            const note = this._parseNote(grade?.normal_note);
            if (note !== null && note < 6.5) {
                failedSubjects.push(subject.subject_name);
            }
        }
        if (failedSubjects.length >= 3) return { label: 'PIERDE AÑO', failed: failedSubjects };
        if (failedSubjects.length >= 1) return { label: 'HABILITA', failed: failedSubjects };
        return { label: '', failed: [] };
    }

    async generateExcel({ period, academicYear, grade, groups, headTeacherName, subjects, students, gradesMap }) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reporte Notas');

        const numSubjects = subjects.length;
        const isFinalPeriod = period.name && period.name.toLowerCase().includes('final');
        const totalColumns = 3 + numSubjects + 1 + (isFinalPeriod ? 1 : 0);

        // Configurar anchos de columna
        worksheet.getColumn(1).width = 12;  // Código
        worksheet.getColumn(2).width = 35;  // Nombre
        for (let i = 0; i < numSubjects; i++) {
            worksheet.getColumn(3 + i).width = 8;
        }
        worksheet.getColumn(3 + numSubjects).width = 8; // Promed
        if (isFinalPeriod) {
            worksheet.getColumn(4 + numSubjects).width = 15; // Estado
        }

        // ========== ENCABEZADOS ==========

        // Fila 1 - Título del colegio
        worksheet.mergeCells(1, 1, 1, totalColumns);
        worksheet.getCell(1, 1).value = 'COLEGIO SAN JOSE DE TARBES';
        worksheet.getCell(1, 1).font = { bold: true, size: 14 };
        worksheet.getCell(1, 1).alignment = { horizontal: 'center' };

        // Fila 2 - vacía
        worksheet.getRow(2).height = 10;

        // Fila 3 - Período
        worksheet.mergeCells(3, 1, 3, totalColumns);
        worksheet.getCell(3, 1).value = `Periodo : ${period.order}-${academicYear.name}`;
        worksheet.getCell(3, 1).alignment = { horizontal: 'left' };

        // Fila 4 - Título del reporte
        worksheet.mergeCells(4, 1, 4, totalColumns);
        worksheet.getCell(4, 1).value = 'INFORME NOTAS PROCESO COGNITIVO';
        worksheet.getCell(4, 1).font = { bold: true };
        worksheet.getCell(4, 1).alignment = { horizontal: 'center' };

        // Fila 5 - vacía
        worksheet.getRow(5).height = 10;

        // Fila 6 - Curso
        worksheet.mergeCells(6, 1, 6, totalColumns);
        worksheet.getCell(6, 1).value = `Curso : ${groups.length ? grade.name + ' ' + groups.map(g => g.name).join(', ') : grade.name}`;
        worksheet.getCell(6, 1).alignment = { horizontal: 'left' };

        // Fila 7 - Director
        worksheet.mergeCells(7, 1, 7, totalColumns);
        worksheet.getCell(7, 1).value = `Director : ${headTeacherName}`;
        worksheet.getCell(7, 1).alignment = { horizontal: 'left' };

        // Fila 8 - separador
        worksheet.getRow(8).height = 5;

        // ========== CABECERA DE TABLA (Fila 9) ==========
        const headerRow = worksheet.getRow(9);
        headerRow.height = 25;

        headerRow.getCell(1).value = 'Código';
        headerRow.getCell(2).value = 'Nombres_Alumno';

        for (let i = 0; i < subjects.length; i++) {
            headerRow.getCell(3 + i).value = subjects[i].subject_name;
        }
        headerRow.getCell(3 + subjects.length).value = 'Promed';
        if (isFinalPeriod) {
            headerRow.getCell(4 + subjects.length).value = 'Estado';
        }

        // Estilo cabecera
        for (let i = 1; i <= totalColumns; i++) {
            const cell = headerRow.getCell(i);
            cell.font = { bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
        }

        // ========== DATOS DE ESTUDIANTES ==========
        let rowIndex = 10;
        const studentAverages = [];
        const subjectSums = new Array(subjects.length).fill(0);
        const subjectCounts = new Array(subjects.length).fill(0);

        for (const student of students) {
            const row = worksheet.getRow(rowIndex);
            let sumNotes = 0;
            let countNotes = 0;

            // Código
            row.getCell(1).value = student.student_code || student.folio_number || '-';
            row.getCell(1).alignment = { horizontal: 'center' };

            // Nombre
            row.getCell(2).value = student.full_name;

            // Notas por materia
            for (let i = 0; i < subjects.length; i++) {
                const subject = subjects[i];
                const grade = gradesMap[student.student_id]?.[subject.subject_id];
                const noteValue = this._parseNote(grade?.normal_note);

                if (noteValue !== null) {
                    const rounded = Math.round(noteValue * 100) / 100;
                    row.getCell(3 + i).value = rounded;
                    row.getCell(3 + i).alignment = { horizontal: 'center' };
                    sumNotes += noteValue;
                    countNotes++;
                    subjectSums[i] += noteValue;
                    subjectCounts[i]++;
                } else {
                    row.getCell(3 + i).value = '-';
                    row.getCell(3 + i).alignment = { horizontal: 'center' };
                }
            }

            // Promedio del estudiante
            const studentAvg = countNotes > 0 ? (sumNotes / countNotes) : null;
            if (studentAvg !== null) {
                const avgRounded = Math.round(studentAvg * 100) / 100;
                row.getCell(3 + subjects.length).value = avgRounded;
                row.getCell(3 + subjects.length).alignment = { horizontal: 'center' };
                studentAverages.push(avgRounded);
            } else {
                row.getCell(3 + subjects.length).value = '-';
                row.getCell(3 + subjects.length).alignment = { horizontal: 'center' };
            }

            // Estado (solo período final)
            if (isFinalPeriod) {
                const status = this._getStudentStatus(student.student_id, subjects, gradesMap);
                const statusCell = row.getCell(4 + subjects.length);
                statusCell.value = status.label;
                statusCell.alignment = { horizontal: 'center' };
                statusCell.font = { bold: status.label !== '' };
                if (status.label === 'PIERDE AÑO') {
                    statusCell.font = { bold: true, color: { argb: 'FFCC0000' } };
                } else if (status.label === 'HABILITA') {
                    statusCell.font = { bold: true, color: { argb: 'FF996600' } };
                }
            }

            rowIndex++;
        }

        // ========== FILA DE PROMEDIOS GENERALES ==========
        const avgRow = worksheet.getRow(rowIndex + 1);
        avgRow.height = 20;

        avgRow.getCell(1).value = 'PROMEDIOS:';
        avgRow.getCell(1).font = { bold: true };
        avgRow.getCell(1).alignment = { horizontal: 'right' };

        // Promedios por materia
        for (let i = 0; i < subjects.length; i++) {
            const subjectAvg = subjectCounts[i] > 0 ? (subjectSums[i] / subjectCounts[i]) : null;
            if (subjectAvg !== null) {
                avgRow.getCell(3 + i).value = Math.round(subjectAvg * 100) / 100;
            } else {
                avgRow.getCell(3 + i).value = '-';
            }
            avgRow.getCell(3 + i).alignment = { horizontal: 'center' };
        }

        // Promedio general
        const overallAvg = studentAverages.length > 0
            ? (studentAverages.reduce((a, b) => a + b, 0) / studentAverages.length)
            : null;
        if (overallAvg !== null) {
            avgRow.getCell(3 + subjects.length).value = Math.round(overallAvg * 100) / 100;
        } else {
            avgRow.getCell(3 + subjects.length).value = '-';
        }
        avgRow.getCell(3 + subjects.length).alignment = { horizontal: 'center' };

        // Estilo para la fila de promedios
        for (let i = 1; i <= totalColumns; i++) {
            const cell = avgRow.getCell(i);
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF5F5F5' }
            };
        }

        // ========== APLICAR BORDES A TODA LA TABLA ==========
        const lastRow = rowIndex;
        for (let r = 9; r <= lastRow; r++) {
            for (let c = 1; c <= totalColumns; c++) {
                const cell = worksheet.getCell(r, c);
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            }
        }

        // Bordes para la fila de promedios
        for (let c = 1; c <= totalColumns; c++) {
            const cell = avgRow.getCell(c);
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        }

        // Generar buffer
        return await workbook.xlsx.writeBuffer();
    }
}

module.exports = GenerateGradeReportExcel;
