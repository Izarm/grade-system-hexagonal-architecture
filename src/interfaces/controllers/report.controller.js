const pool = require('../../infrastructure/database/mysql');
const StudentRepository = require('../../infrastructure/repositories/StudentRepository');
const GenerateStudentReportCard = require('../../application/use-cases/reports/GenerateStudentReportCard');
const GenerateAlphabeticalList = require('../../application/use-cases/reports/GenerateAlphabeticalList');
const GenerateExcelList = require('../../application/use-cases/reports/GenerateExcelList');
const GenerateBulkReportCards = require('../../application/use-cases/reports/GenerateBulkReportCards');
const GeneratePeriodReportWord = require('../../application/use-cases/reports/GeneratePeriodReportWord');
const GenerateFinalReportWord = require('../../application/use-cases/reports/GenerateFinalReportWord');
const GeneratePeriodReportExcel = require('../../application/use-cases/reports/GeneratePeriodReportExcel');
const GenerateFinalReportExcel = require('../../application/use-cases/reports/GenerateFinalReportExcel');
const GenerateGradeReportExcel = require('../../application/use-cases/reports/GenerateGradeReportExcel');
const GenerateGradeReportAttitudinalExcel = require('../../application/use-cases/reports/GenerateGradeReportAttitudinalExcel');
const GenerateGradeReportElectivesExcel = require('../../application/use-cases/reports/GenerateGradeReportElectivesExcel');
const GenerateGradeReportWord = require('../../application/use-cases/reports/GenerateGradeReportWord');
const GenerateGradeReportAttitudinalWord = require('../../application/use-cases/reports/GenerateGradeReportAttitudinalWord');
const GenerateGradeReportElectivesWord = require('../../application/use-cases/reports/GenerateGradeReportElectivesWord');
const archiver = require('archiver');

const studentRepo = new StudentRepository();
const generateReportCard = new GenerateStudentReportCard(studentRepo);
const generatePdfList = new GenerateAlphabeticalList(studentRepo);
const generateExcelList = new GenerateExcelList(studentRepo);
const bulkReport = new GenerateBulkReportCards(studentRepo);

// ==================== FUNCIONES AUXILIARES ====================

async function getGradeName(gradeId) {
    const [rows] = await pool.query(
        `SELECT name FROM grades WHERE id = ?`,
        [gradeId]
    );
    if (rows.length === 0) return 'Desconocido';
    return rows[0].name.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_');
}

async function getCleanGradeName(gradeName) {
    return gradeName.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_');
}

// ==================== EXISTENTES ====================

exports.getFullStructure = async (req, res) => {
    try {
        const [years] = await pool.query(
            `SELECT id, name, start_date, end_date, active 
             FROM academic_years WHERE deleted_at IS NULL ORDER BY start_date DESC`
        );
        
        const [periods] = await pool.query(
            `SELECT p.id, p.academic_year_id, p.name, p.order, 
                    p.start_date, p.end_date, p.status, 
                    u.name as closed_by_name 
             FROM periods p
             LEFT JOIN users u ON p.closed_by = u.id
             WHERE p.deleted_at IS NULL 
             ORDER BY p.academic_year_id, p.order`
        );
        
        const [grades] = await pool.query(
            `SELECT id, name FROM grades WHERE deleted_at IS NULL ORDER BY name`
        );
        
        const [subjects] = await pool.query(
            `SELECT id, name, area FROM subjects WHERE deleted_at IS NULL ORDER BY name`
        );
        
        const [assignments] = await pool.query(
            `SELECT sa.id, sa.is_elective,
                    g.name as grade_name,
                    grp.name as group_name,
                    s.name as subject_name, 
                    u.name as teacher_name,
                    ay.name as academic_year_name
             FROM subject_assignments sa
             JOIN \`groups\` grp ON sa.group_id = grp.id
             JOIN grades g ON grp.grade_id = g.id
             JOIN subjects s ON sa.subject_id = s.id
             JOIN users u ON sa.teacher_id = u.id
             JOIN academic_years ay ON sa.academic_year_id = ay.id
             WHERE sa.deleted_at IS NULL
             ORDER BY ay.name, g.name, grp.name, s.name`
        );
        
        res.json({
            academicYears: years,
            periods: periods,
            grades: grades,
            subjects: subjects,
            assignments: assignments
        });
    } catch (error) {
        console.error('Error en getFullStructure:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.getTeacherAssignmentsWithGrades = async (req, res) => {
    try {
        const teacherId = req.user.id;
        const userRole = req.user.role;
        const { academicYearId, subjectAssignmentId, periodId, gradeId } = req.query;
        
        console.log('=== getTeacherAssignmentsWithGrades ===');
        console.log('teacherId:', teacherId);
        console.log('userRole:', userRole);
        console.log('academicYearId:', academicYearId);
        console.log('subjectAssignmentId:', subjectAssignmentId);
        console.log('periodId:', periodId);
        console.log('gradeId:', gradeId);
        
        let query = `
            SELECT sa.id, sa.group_id, sa.subject_id, sa.academic_year_id, sa.is_elective,
                   g.name as grade_name, grp.name as group_name, 
                   s.name as subject_name, s.area,
                   ay.name as academic_year_name
            FROM subject_assignments sa
            JOIN \`groups\` grp ON sa.group_id = grp.id
            JOIN grades g ON grp.grade_id = g.id
            JOIN subjects s ON sa.subject_id = s.id
            JOIN academic_years ay ON sa.academic_year_id = ay.id
            WHERE sa.deleted_at IS NULL
        `;
        const params = [];
        
        if (userRole === 'docente') {
            query += ` AND sa.teacher_id = ?`;
            params.push(teacherId);
        }
        
        if (academicYearId) {
            query += ` AND sa.academic_year_id = ?`;
            params.push(parseInt(academicYearId));
        }
        
        query += ` ORDER BY ay.name DESC, g.name, grp.name, s.name`;
        
        const [assignments] = await pool.query(query, params);
        console.log('Asignaciones encontradas:', assignments.length);
        
        let students = null;
        let periodStatus = null;
        
        if (subjectAssignmentId && periodId) {
            const [period] = await pool.query(
                `SELECT status FROM periods WHERE id = ? AND deleted_at IS NULL`,
                [periodId]
            );
            periodStatus = period[0]?.status || null;
            console.log('Period status:', periodStatus);
            
            const [assignment] = await pool.query(
                `SELECT group_id, academic_year_id, is_elective FROM subject_assignments WHERE id = ? AND deleted_at IS NULL`,
                [subjectAssignmentId]
            );
            
            console.log('Assignment query result:', assignment);
            
            if (assignment.length > 0) {
                const isElectiveAssignment = assignment[0].is_elective === 1;
                console.log('Es asignación electiva:', isElectiveAssignment);
                
                if (isElectiveAssignment) {
                    let studentsQuery = `
                        SELECT s.id, s.full_name, s.student_code, 
                               e.id as enrollment_id, e.folio_number,
                               g.name as grade_name
                        FROM enrollments e
                        JOIN students s ON e.student_id = s.id
                        JOIN \`groups\` grp ON e.group_id = grp.id
                        JOIN grades g ON grp.grade_id = g.id
                        WHERE e.academic_year_id = ? AND e.deleted_at IS NULL
                    `;
                    const studentsParams = [assignment[0].academic_year_id];
                    
                    if (gradeId && gradeId !== '') {
                        studentsQuery += ` AND g.id = ?`;
                        studentsParams.push(parseInt(gradeId));
                    }
                    
                    studentsQuery += ` ORDER BY g.name, e.folio_number ASC, s.full_name ASC`;
                    
                    [students] = await pool.query(studentsQuery, studentsParams);
                    console.log('Estudiantes electivos encontrados:', students ? students.length : 0);
                } else {
                    [students] = await pool.query(
                        `SELECT s.id, s.full_name, s.student_code, e.id as enrollment_id, e.folio_number,
                                g.name as grade_name
                         FROM enrollments e
                         JOIN students s ON e.student_id = s.id
                         JOIN \`groups\` grp ON e.group_id = grp.id
                         JOIN grades g ON grp.grade_id = g.id
                         WHERE e.group_id = ? AND e.academic_year_id = ? AND e.deleted_at IS NULL
                         ORDER BY e.folio_number ASC, s.full_name ASC`,
                        [assignment[0].group_id, assignment[0].academic_year_id]
                    );
                    console.log('Estudiantes regulares encontrados:', students ? students.length : 0);
                }
                
                if (students && students.length > 0) {
                    const [grades] = await pool.query(
                        `SELECT gr.*, e.student_id
                         FROM grade_records gr
                         JOIN enrollments e ON gr.enrollment_id = e.id
                         WHERE gr.subject_assignment_id = ? AND gr.period_id = ? AND gr.deleted_at IS NULL`,
                        [subjectAssignmentId, periodId]
                    );
                    
                    console.log('Notas encontradas:', grades.length);
                    
                    const gradesMap = {};
                    grades.forEach(g => {
                        gradesMap[g.student_id] = {
                            id: g.id,
                            normal_note: g.normal_note,
                            aptitudinal_note: g.aptitudinal_note,
                            absences: g.absences,
                            average: parseFloat(g.average),
                            is_elective: g.is_elective
                        };
                    });
                    
                    students = students.map(s => ({
                        ...s,
                        grade: gradesMap[s.id] || null
                    }));
                }
            } else {
                console.log('No se encontró la asignación con id:', subjectAssignmentId);
            }
        }
        
        const [years] = await pool.query(
            `SELECT id, name FROM academic_years WHERE deleted_at IS NULL ORDER BY name DESC`
        );
        let periods = [];
        if (academicYearId) {
            [periods] = await pool.query(
                `SELECT id, name, status FROM periods WHERE academic_year_id = ? AND deleted_at IS NULL ORDER BY \`order\``,
                [academicYearId]
            );
        }
        
        const [allGrades] = await pool.query(
            `SELECT id, name FROM grades WHERE deleted_at IS NULL ORDER BY name`
        );
        
        res.json({
            assignments,
            students,
            periodStatus,
            years,
            periods,
            grades: allGrades
        });
    } catch (error) {
        console.error('Error en getTeacherAssignmentsWithGrades:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.getStudentsList = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, full_name, student_code FROM students WHERE deleted_at IS NULL ORDER BY full_name`
        );
        res.json(rows);
    } catch (error) {
        console.error('Error en getStudentsList:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.generateStudentReportCard = async (req, res) => {
    try {
        const { studentId, academicYearId } = req.query;
        if (!studentId || !academicYearId) {
            return res.status(400).json({ message: 'Se requieren studentId y academicYearId' });
        }
        
        const pdfBuffer = await generateReportCard.execute(parseInt(studentId), parseInt(academicYearId));
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=boletin_${studentId}_${academicYearId}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error en generateStudentReportCard:', error);
        res.status(400).json({ message: error.message });
    }
};

exports.generateAlphabeticalList = async (req, res) => {
    try {
        const { academicYearId, groupId, format = 'pdf' } = req.query;
        if (!academicYearId) {
            return res.status(400).json({ message: 'Se requiere academicYearId' });
        }
        
        let buffer;
        if (format === 'excel') {
            buffer = await generateExcelList.execute(parseInt(academicYearId), groupId ? parseInt(groupId) : null);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=listado_estudiantes_${academicYearId}.xlsx`);
        } else {
            buffer = await generatePdfList.execute(parseInt(academicYearId), groupId ? parseInt(groupId) : null, 'pdf');
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=listado_estudiantes_${academicYearId}.pdf`);
        }
        res.send(buffer);
    } catch (error) {
        console.error('Error en generateAlphabeticalList:', error);
        res.status(400).json({ message: error.message });
    }
};

exports.generateBulkReportCards = async (req, res) => {
    try {
        const { academicYearId, gradeId, groupId } = req.query;
        if (!academicYearId) {
            return res.status(400).json({ message: 'Se requiere academicYearId' });
        }
        if (!gradeId && !groupId) {
            return res.status(400).json({ message: 'Debe especificar gradeId o groupId' });
        }
        
        const zipBuffer = await bulkReport.execute(
            parseInt(academicYearId),
            gradeId ? parseInt(gradeId) : null,
            groupId ? parseInt(groupId) : null
        );
        
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename=boletines_${academicYearId}${gradeId ? '_grado_'+gradeId : ''}.zip`);
        res.send(zipBuffer);
    } catch (error) {
        console.error('Error en generateBulkReportCards:', error);
        res.status(400).json({ message: error.message });
    }
};

// ==================== REPORTES WORD ====================

exports.generatePeriodReportWord = async (req, res) => {
    try {
        const { studentId, academicYearId, periodId, studentName, periodName } = req.query;
        if (!studentId || !academicYearId || !periodId) {
            return res.status(400).json({ message: 'Faltan parámetros' });
        }
        
        const finalStudentName = studentName || `Estudiante_${studentId}`;
        const finalPeriodName = periodName || '1';
        const fileName = `Boletin_${finalStudentName}_Periodo_${finalPeriodName}.docx`;
        
        const generator = new GeneratePeriodReportWord(pool);
        const buffer = await generator.execute(parseInt(studentId), parseInt(academicYearId), parseInt(periodId));
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.send(buffer);
    } catch (error) {
        console.error('Error en generatePeriodReportWord:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.generateFinalReportWord = async (req, res) => {
    try {
        const { studentId, academicYearId, studentName } = req.query;
        if (!studentId || !academicYearId) {
            return res.status(400).json({ message: 'Faltan parámetros' });
        }
        
        const finalStudentName = studentName || `Estudiante_${studentId}`;
        const fileName = `Boletin_${finalStudentName}_Final.docx`;
        
        const generator = new GenerateFinalReportWord(pool);
        const buffer = await generator.execute(parseInt(studentId), parseInt(academicYearId));
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.send(buffer);
    } catch (error) {
        console.error('Error en generateFinalReportWord:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.generateBulkWordReports = async (req, res) => {
    try {
        const { academicYearId, gradeId, type = 'period', periodId } = req.query;
        
        if (!academicYearId) {
            return res.status(400).json({ message: 'Faltan academicYearId' });
        }
        
        const isMassive = type === 'massive_period' || type === 'massive_final';
        const archive = archiver('zip', { zlib: { level: 9 } });
        let fileName = '';
        let gradosConEstudiantes = [];
        
        if (isMassive) {
            fileName = type === 'massive_period' ? `Boletines_Masivos_Periodo_${periodId}.zip` : 'Boletines_Masivos_Final.zip';
            
            const [grados] = await pool.query(
                `SELECT DISTINCT g.id, g.name 
                 FROM grades g
                 JOIN \`groups\` grp ON g.id = grp.grade_id
                 JOIN enrollments e ON grp.id = e.group_id
                 WHERE e.academic_year_id = ? AND e.deleted_at IS NULL
                 ORDER BY CAST(g.name AS UNSIGNED) ASC, RIGHT(g.name, 1) ASC`,
                [academicYearId]
            );
            
            for (const grado of grados) {
                const [students] = await pool.query(
                    `SELECT DISTINCT s.id, s.full_name
                     FROM students s
                     JOIN enrollments e ON s.id = e.student_id
                     JOIN \`groups\` grp ON e.group_id = grp.id
                     WHERE grp.grade_id = ? AND e.academic_year_id = ? AND e.deleted_at IS NULL
                     ORDER BY s.full_name ASC`,
                    [grado.id, academicYearId]
                );
                
                if (students.length > 0) {
                    gradosConEstudiantes.push({
                        id: grado.id,
                        nombre: grado.name,
                        estudiantes: students
                    });
                }
            }
        } else {
            if (!gradeId) {
                return res.status(400).json({ message: 'Faltan gradeId' });
            }
            
            const [gradeRows] = await pool.query(`SELECT id, name FROM grades WHERE id = ?`, [gradeId]);
            const gradeName = gradeRows[0]?.name || 'Grado';
            const tipoTexto = type === 'period' ? 'Periodo' : 'Final';
            let periodoTexto = '';
            
            if (type === 'period' && periodId) {
                const [periodRows] = await pool.query(`SELECT \`order\` FROM periods WHERE id = ?`, [periodId]);
                if (periodRows.length > 0) periodoTexto = `_Periodo_${periodRows[0].order}`;
            }
            
            fileName = `Boletines_Grado_${await getCleanGradeName(gradeName)}_${tipoTexto}${periodoTexto}.zip`;
            
            const [students] = await pool.query(
                `SELECT DISTINCT s.id, s.full_name
                 FROM students s
                 JOIN enrollments e ON s.id = e.student_id
                 JOIN \`groups\` grp ON e.group_id = grp.id
                 WHERE grp.grade_id = ? AND e.academic_year_id = ? AND e.deleted_at IS NULL
                 ORDER BY s.full_name ASC`,
                [gradeId, academicYearId]
            );
            
            if (students.length > 0) {
                gradosConEstudiantes.push({
                    id: gradeId,
                    nombre: gradeName,
                    estudiantes: students
                });
            }
        }
        
        if (gradosConEstudiantes.length === 0) {
            return res.status(404).json({ message: 'No hay estudiantes para generar reportes' });
        }
        
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        archive.pipe(res);
        
        for (const grado of gradosConEstudiantes) {
            const folderName = await getCleanGradeName(grado.nombre);
            for (const student of grado.estudiantes) {
                const studentNameClean = student.full_name.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_');
                let docName = '';
                let buffer;
                
                if (type === 'final' || type === 'massive_final') {
                    const generator = new GenerateFinalReportWord(pool);
                    buffer = await generator.execute(student.id, parseInt(academicYearId));
                    docName = `${studentNameClean}_Final.docx`;
                } else {
                    const periodoId = periodId || (await pool.query(`SELECT id FROM periods WHERE academic_year_id = ? ORDER BY \`order\` LIMIT 1`, [academicYearId]))[0]?.id;
                    if (!periodoId) continue;
                    const generator = new GeneratePeriodReportWord(pool);
                    buffer = await generator.execute(student.id, parseInt(academicYearId), parseInt(periodoId));
                    const [periodRows] = await pool.query(`SELECT \`order\` FROM periods WHERE id = ?`, [periodoId]);
                    docName = `${studentNameClean}_Periodo_${periodRows[0]?.order || '1'}.docx`;
                }
                archive.append(buffer, { name: `${folderName}/${docName}` });
            }
        }
        await archive.finalize();
    } catch (error) {
        console.error('Error en generateBulkWordReports:', error);
        res.status(500).json({ message: error.message });
    }
};

// ==================== REPORTES EXCEL ====================

exports.generatePeriodReportExcel = async (req, res) => {
    try {
        const { studentId, academicYearId, periodId } = req.query;
        if (!studentId || !academicYearId || !periodId) {
            return res.status(400).json({ message: 'Faltan parámetros' });
        }
        
        const generator = new GeneratePeriodReportExcel(pool);
        const buffer = await generator.execute(parseInt(studentId), parseInt(academicYearId), parseInt(periodId));
        
        const fileName = `Boletin_Excel_${studentId}_Periodo_${periodId}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.send(buffer);
    } catch (error) {
        console.error('Error en generatePeriodReportExcel:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.generateFinalReportExcel = async (req, res) => {
    try {
        const { studentId, academicYearId } = req.query;
        if (!studentId || !academicYearId) {
            return res.status(400).json({ message: 'Faltan parámetros' });
        }
        
        const generator = new GenerateFinalReportExcel(pool);
        const buffer = await generator.execute(parseInt(studentId), parseInt(academicYearId));
        
        const fileName = `Boletin_Excel_${studentId}_Final.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.send(buffer);
    } catch (error) {
        console.error('Error en generateFinalReportExcel:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.generateGradeReportExcel = async (req, res) => {
    try {
        const { academicYearId, periodId, gradeId, groupId } = req.query;
        if (!academicYearId || !periodId || !gradeId) {
            return res.status(400).json({ message: 'Se requieren academicYearId, periodId y gradeId' });
        }
        
        const generator = new GenerateGradeReportExcel(pool);
        const buffer = await generator.execute({
            academicYearId: parseInt(academicYearId),
            periodId: parseInt(periodId),
            gradeId: parseInt(gradeId),
            groupId: groupId ? parseInt(groupId) : null
        });
        
        const fileName = `Reporte_Notas_Grado_${gradeId}_Periodo_${periodId}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.send(buffer);
    } catch (error) {
        console.error('Error en generateGradeReportExcel:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.generateGradeReportAttitudinalExcel = async (req, res) => {
    try {
        const { academicYearId, periodId, gradeId, groupId } = req.query;
        if (!academicYearId || !periodId || !gradeId) {
            return res.status(400).json({ message: 'Se requieren academicYearId, periodId y gradeId' });
        }

        const generator = new GenerateGradeReportAttitudinalExcel(pool);
        const buffer = await generator.execute({
            academicYearId: parseInt(academicYearId),
            periodId: parseInt(periodId),
            gradeId: parseInt(gradeId),
            groupId: groupId ? parseInt(groupId) : null
        });

        const fileName = `Reporte_Notas_Actitudinales_Grado_${gradeId}_Periodo_${periodId}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.send(buffer);
    } catch (error) {
        console.error('Error en generateGradeReportAttitudinalExcel:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.generateGradeReportElectivesExcel = async (req, res) => {
    try {
        const { academicYearId, periodId, gradeId, groupId } = req.query;
        if (!academicYearId || !periodId || !gradeId) {
            return res.status(400).json({ message: 'Se requieren academicYearId, periodId y gradeId' });
        }

        const generator = new GenerateGradeReportElectivesExcel(pool);
        const buffer = await generator.execute({
            academicYearId: parseInt(academicYearId),
            periodId: parseInt(periodId),
            gradeId: parseInt(gradeId),
            groupId: groupId ? parseInt(groupId) : null
        });

        const fileName = `Reporte_Notas_Electivas_Grado_${gradeId}_Periodo_${periodId}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.send(buffer);
    } catch (error) {
        console.error('Error en generateGradeReportElectivesExcel:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.generateBulkExcelReports = async (req, res) => {
    try {
        const { academicYearId, type = 'massive_period', periodId } = req.query;
        
        if (!academicYearId) {
            return res.status(400).json({ message: 'Faltan academicYearId' });
        }
        
        const archive = archiver('zip', { zlib: { level: 9 } });
        const fileName = type === 'massive_period' ? `Reportes_Excel_Masivos_Periodo_${periodId}.zip` : 'Reportes_Excel_Masivos_Final.zip';
        
        const [grados] = await pool.query(
            `SELECT DISTINCT g.id, g.name 
             FROM grades g
             JOIN \`groups\` grp ON g.id = grp.grade_id
             JOIN enrollments e ON grp.id = e.group_id
             WHERE e.academic_year_id = ? AND e.deleted_at IS NULL
             ORDER BY CAST(g.name AS UNSIGNED) ASC, RIGHT(g.name, 1) ASC`,
            [academicYearId]
        );
        
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        archive.pipe(res);
        
        for (const grado of grados) {
            const [students] = await pool.query(
                `SELECT DISTINCT s.id, s.full_name
                 FROM students s
                 JOIN enrollments e ON s.id = e.student_id
                 JOIN \`groups\` grp ON e.group_id = grp.id
                 WHERE grp.grade_id = ? AND e.academic_year_id = ? AND e.deleted_at IS NULL
                 ORDER BY s.full_name ASC`,
                [grado.id, academicYearId]
            );
            
            const folderName = grado.name.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_');
            
            for (const student of students) {
                const studentNameClean = student.full_name.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_');
                let buffer;
                let docName;
                
                if (type === 'massive_final') {
                    const generator = new GenerateFinalReportExcel(pool);
                    buffer = await generator.execute(student.id, parseInt(academicYearId));
                    docName = `${studentNameClean}_Final.xlsx`;
                } else {
                    const periodoId = periodId || (await pool.query(`SELECT id FROM periods WHERE academic_year_id = ? ORDER BY \`order\` LIMIT 1`, [academicYearId]))[0]?.id;
                    if (!periodoId) continue;
                    const generator = new GeneratePeriodReportExcel(pool);
                    buffer = await generator.execute(student.id, parseInt(academicYearId), parseInt(periodoId));
                    docName = `${studentNameClean}.xlsx`;
                }
                archive.append(buffer, { name: `${folderName}/${docName}` });
            }
        }
        
        await archive.finalize();
    } catch (error) {
        console.error('Error en generateBulkExcelReports:', error);
        res.status(500).json({ message: error.message });
    }
};
exports.generateGradeReportWord = async (req, res) => {
    try {
        const { academicYearId, periodId, gradeId } = req.query;
        if (!academicYearId || !periodId || !gradeId) return res.status(400).json({ message: 'Faltan parámetros' });
        const generator = new GenerateGradeReportWord(pool);
        const buffer = await generator.execute({ academicYearId: parseInt(academicYearId), periodId: parseInt(periodId), gradeId: parseInt(gradeId) });
        const gradeName = await getGradeName(gradeId);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="Notas_Cognitivas_${gradeName}_P${periodId}.docx"`);
        res.send(buffer);
    } catch (error) {
        console.error('Error generando Word cognitivo:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.generateGradeReportAttitudinalWord = async (req, res) => {
    try {
        const { academicYearId, periodId, gradeId } = req.query;
        if (!academicYearId || !periodId || !gradeId) return res.status(400).json({ message: 'Faltan parámetros' });
        const generator = new GenerateGradeReportAttitudinalWord(pool);
        const buffer = await generator.execute({ academicYearId: parseInt(academicYearId), periodId: parseInt(periodId), gradeId: parseInt(gradeId) });
        const gradeName = await getGradeName(gradeId);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="Notas_Actitudinales_${gradeName}_P${periodId}.docx"`);
        res.send(buffer);
    } catch (error) {
        console.error('Error generando Word actitudinal:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.generateGradeReportElectivesWord = async (req, res) => {
    try {
        const { academicYearId, periodId, gradeId } = req.query;
        if (!academicYearId || !periodId || !gradeId) return res.status(400).json({ message: 'Faltan parámetros' });
        const generator = new GenerateGradeReportElectivesWord(pool);
        const buffer = await generator.execute({ academicYearId: parseInt(academicYearId), periodId: parseInt(periodId), gradeId: parseInt(gradeId) });
        const gradeName = await getGradeName(gradeId);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="Notas_Electivas_${gradeName}_P${periodId}.docx"`);
        res.send(buffer);
    } catch (error) {
        console.error('Error generando Word electivas:', error);
        res.status(500).json({ message: error.message });
    }
};
