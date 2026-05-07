const pool = require('../../infrastructure/database/mysql');
const StudentRepository = require('../../infrastructure/repositories/StudentRepository');
const GenerateStudentReportCard = require('../../application/use-cases/reports/GenerateStudentReportCard');
const GenerateAlphabeticalList = require('../../application/use-cases/reports/GenerateAlphabeticalList');
const GenerateExcelList = require('../../application/use-cases/reports/GenerateExcelList');
const GenerateBulkReportCards = require('../../application/use-cases/reports/GenerateBulkReportCards');

const studentRepo = new StudentRepository();
const generateReportCard = new GenerateStudentReportCard(studentRepo);
const generatePdfList = new GenerateAlphabeticalList(studentRepo);
const generateExcelList = new GenerateExcelList(studentRepo);
const bulkReport = new GenerateBulkReportCards(studentRepo);

// ==================== ADMIN: ESTRUCTURA COMPLETA ====================
exports.getFullStructure = async (req, res) => {
    try {
        // Años lectivos
        const [years] = await pool.query(
            `SELECT id, name, start_date, end_date, active 
             FROM academic_years WHERE deleted_at IS NULL ORDER BY start_date DESC`
        );
        
        // Períodos (con información de cierre)
        const [periods] = await pool.query(
            `SELECT p.*, u.name as closed_by_name 
             FROM periods p
             LEFT JOIN users u ON p.closed_by = u.id
             WHERE p.deleted_at IS NULL 
             ORDER BY p.academic_year_id, p.order`
        );
        
        // Grados
        const [grades] = await pool.query(
            `SELECT id, name FROM grades WHERE deleted_at IS NULL ORDER BY name`
        );
        
        // Grupos
        const [groups] = await pool.query(
            `SELECT g.id, g.name, gr.name as grade_name 
             FROM groups g
             JOIN grades gr ON g.grade_id = gr.id
             WHERE g.deleted_at IS NULL 
             ORDER BY gr.name, g.name`
        );
        
        // Asignaturas
        const [subjects] = await pool.query(
            `SELECT id, name, area, intensity_hours 
             FROM subjects WHERE deleted_at IS NULL ORDER BY name`
        );
        
        // Asignaciones (con nombres)
        const [assignments] = await pool.query(
            `SELECT sa.id, gr.name as grade_name, g.name as group_name, 
                    s.name as subject_name, u.name as teacher_name,
                    ay.name as academic_year_name
             FROM subject_assignments sa
             JOIN groups g ON sa.group_id = g.id
             JOIN grades gr ON g.grade_id = gr.id
             JOIN subjects s ON sa.subject_id = s.id
             JOIN users u ON sa.teacher_id = u.id
             JOIN academic_years ay ON sa.academic_year_id = ay.id
             WHERE sa.deleted_at IS NULL
             ORDER BY ay.name, gr.name, g.name, s.name`
        );
        
        res.json({
            academicYears: years,
            periods: periods,
            grades: grades,
            groups: groups,
            subjects: subjects,
            assignments: assignments
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ==================== ADMIN/DOCENTE: ASIGNACIONES CON NOTAS ====================
exports.getTeacherAssignmentsWithGrades = async (req, res) => {
    try {
        const teacherId = req.user.id;
        const { academicYearId, subjectAssignmentId, periodId } = req.query;
        
        // Obtener asignaciones del docente
        let query = `
            SELECT sa.id, sa.group_id, sa.subject_id, sa.academic_year_id,
                   g.name as group_name, gr.name as grade_name, 
                   s.name as subject_name, s.area,
                   ay.name as academic_year_name
            FROM subject_assignments sa
            JOIN groups g ON sa.group_id = g.id
            JOIN grades gr ON g.grade_id = gr.id
            JOIN subjects s ON sa.subject_id = s.id
            JOIN academic_years ay ON sa.academic_year_id = ay.id
            WHERE sa.teacher_id = ? AND sa.deleted_at IS NULL
        `;
        const params = [teacherId];
        
        if (academicYearId) {
            query += ` AND sa.academic_year_id = ?`;
            params.push(academicYearId);
        }
        
        query += ` ORDER BY ay.name DESC, gr.name, g.name, s.name`;
        
        const [assignments] = await pool.query(query, params);
        
        // Si hay una asignación específica, obtener los estudiantes y sus notas
        let students = null;
        let periodStatus = null;
        
        if (subjectAssignmentId && periodId) {
            // Verificar estado del período
            const [period] = await pool.query(
                `SELECT status, name FROM periods WHERE id = ? AND deleted_at IS NULL`,
                [periodId]
            );
            periodStatus = period[0]?.status || null;
            
            // Obtener estudiantes del grupo
            const assignment = assignments.find(a => a.id == subjectAssignmentId);
            if (assignment) {
                [students] = await pool.query(
                    `SELECT s.id, s.full_name, s.document, e.id as enrollment_id
                     FROM enrollments e
                     JOIN students s ON e.student_id = s.id
                     WHERE e.group_id = ? AND e.academic_year_id = ? AND e.deleted_at IS NULL
                     ORDER BY s.full_name`,
                    [assignment.group_id, assignment.academic_year_id]
                );
                
                // Obtener notas existentes
                const [grades] = await pool.query(
                    `SELECT gr.*, e.student_id
                     FROM grade_records gr
                     JOIN enrollments e ON gr.enrollment_id = e.id
                     WHERE gr.subject_assignment_id = ? AND gr.period_id = ? AND gr.deleted_at IS NULL`,
                    [subjectAssignmentId, periodId]
                );
                
                // Mapear notas por estudiante
                const gradesMap = {};
                grades.forEach(g => {
                    gradesMap[g.student_id] = {
                        normal_note: g.normal_note,
                        aptitudinal_note: g.aptitudinal_note,
                        average: g.average
                    };
                });
                
                students = students.map(s => ({
                    ...s,
                    grades: gradesMap[s.id] || { normal_note: null, aptitudinal_note: null, average: null }
                }));
            }
        }
        
        // Obtener años y períodos para los filtros
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
        
        res.json({
            assignments,
            currentAssignmentId: subjectAssignmentId || null,
            currentPeriodId: periodId || null,
            periodStatus,
            students,
            years,
            periods
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ==================== LISTA DE ESTUDIANTES (para selectores) ====================
exports.getStudentsList = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, full_name, document FROM students WHERE deleted_at IS NULL ORDER BY full_name`
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ==================== GENERAR BOLETÍN INDIVIDUAL PDF ====================
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
        res.status(400).json({ message: error.message });
    }
};

// ==================== GENERAR LISTADO ALFABÉTICO (PDF o EXCEL) ====================
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
        const zipBuffer = await bulkReport.execute(parseInt(academicYearId), gradeId ? parseInt(gradeId) : null, groupId ? parseInt(groupId) : null);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename=boletines_${academicYearId}${gradeId ? '_grado_'+gradeId : ''}.zip`);
        res.send(zipBuffer);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};