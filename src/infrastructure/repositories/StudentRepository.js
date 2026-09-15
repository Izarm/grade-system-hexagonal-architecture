const pool = require('../database/mysql');
const { ordenGrado } = require('../../shared/ordenGrados');

class StudentRepository {
    async generateCode() {
        const year = new Date().getFullYear();
        // Formato: AÑO + secuencia de 3 dígitos, sin separador (ej: 2026080).
        // Se toma el mayor consecutivo existente del año (incluye soft-deleted
        // para no reutilizar códigos) y se incrementa en 1.
        const [rows] = await pool.query(
            `SELECT MAX(CAST(SUBSTRING(student_code, 5) AS UNSIGNED)) AS maxSeq
             FROM students
             WHERE student_code LIKE ?
               AND student_code REGEXP ?`,
            [`${year}%`, `^${year}[0-9]+$`]
        );
        const nextSeq = (rows[0]?.maxSeq || 0) + 1;
        return `${year}${String(nextSeq).padStart(3, '0')}`;
    }

    async create(data) {
        const {
            // El nombre va separado en apellidos y nombres.
            // `full_name` es una columna calculada: no se escribe nunca.
            lastName, firstName, studentCode, birthDate, folioNumber,
            // Campos nuevos de San José de Tarbes
            documentType, documentNumber, documentIssueDate, documentIssuePlace,
            phoneLandline, phoneMobile1, phoneMobile2,
            emailFather, emailMother, address, guardian,
            admissionDate, withdrawalDate, withdrawalReason, observations
        } = data;

        // Reactivar si existe un estudiante soft-deleted con el mismo código
        const [deleted] = await pool.query(
            `SELECT id FROM students WHERE student_code = ? AND deleted_at IS NOT NULL`,
            [studentCode]
        );
        if (deleted.length > 0) {
            await pool.query(
                `UPDATE students
                 SET last_name = ?, first_name = ?, birth_date = ?, folio_number = ?,
                     document_type = ?, document_number = ?,
                     document_issue_date = ?, document_issue_place = ?,
                     phone_landline = ?, phone_mobile1 = ?, phone_mobile2 = ?,
                     email_father = ?, email_mother = ?, address = ?, guardian = ?,
                     admission_date = ?, withdrawal_date = ?, withdrawal_reason = ?, observations = ?,
                     deleted_at = NULL
                 WHERE id = ?`,
                [
                    lastName, firstName, birthDate || null, folioNumber || null,
                    documentType || null, documentNumber || null,
                    documentIssueDate || null, documentIssuePlace || null,
                    phoneLandline || null, phoneMobile1 || null, phoneMobile2 || null,
                    emailFather || null, emailMother || null, address || null, guardian || null,
                    admissionDate || null, withdrawalDate || null, withdrawalReason || null, observations || null,
                    deleted[0].id
                ]
            );
            return {
                id: deleted[0].id,
                last_name: lastName,
                first_name: firstName,
                full_name: `${lastName} ${firstName}`.trim(),
                student_code: studentCode
            };
        }

        const docsJson = data.documents != null
            ? JSON.stringify(Array.isArray(data.documents) ? data.documents : [])
            : null;
        const [result] = await pool.query(
            `INSERT INTO students
             (last_name, first_name, student_code, birth_date, folio_number,
              document_type, document_number, document_issue_date, document_issue_place,
              phone_landline, phone_mobile1, phone_mobile2,
              email_father, email_mother, address, guardian,
              admission_date, withdrawal_date, withdrawal_reason, observations, documents)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                lastName, firstName, studentCode, birthDate || null, folioNumber || null,
                documentType || null, documentNumber || null,
                documentIssueDate || null, documentIssuePlace || null,
                phoneLandline || null, phoneMobile1 || null, phoneMobile2 || null,
                emailFather || null, emailMother || null, address || null, guardian || null,
                admissionDate || null, withdrawalDate || null, withdrawalReason || null, observations || null,
                docsJson
            ]
        );
        return {
            id: result.insertId,
            last_name: lastName,
            first_name: firstName,
            full_name: `${lastName} ${firstName}`.trim(),
            student_code: studentCode
        };
    }

    async update(id, data) {
        const {
            lastName, firstName, studentCode, birthDate, folioNumber,
            // Campos nuevos de San José de Tarbes
            documentType, documentNumber, documentIssueDate, documentIssuePlace,
            phoneLandline, phoneMobile1, phoneMobile2,
            emailFather, emailMother, address, guardian,
            admissionDate, withdrawalDate, withdrawalReason, observations
        } = data;
        // Si no se envía 'documents', se conserva el valor existente (COALESCE).
        const docsJson = data.documents != null
            ? JSON.stringify(Array.isArray(data.documents) ? data.documents : [])
            : null;
        const [result] = await pool.query(
            `UPDATE students
             SET last_name = ?, first_name = ?, student_code = ?, birth_date = ?, folio_number = ?,
                 document_type = ?, document_number = ?,
                 document_issue_date = ?, document_issue_place = ?,
                 phone_landline = ?, phone_mobile1 = ?, phone_mobile2 = ?,
                 email_father = ?, email_mother = ?, address = ?, guardian = ?,
                 admission_date = ?, withdrawal_date = ?, withdrawal_reason = ?, observations = ?,
                 documents = COALESCE(?, documents)
             WHERE id = ? AND deleted_at IS NULL`,
            [
                lastName, firstName, studentCode, birthDate || null, folioNumber || null,
                documentType || null, documentNumber || null,
                documentIssueDate || null, documentIssuePlace || null,
                phoneLandline || null, phoneMobile1 || null, phoneMobile2 || null,
                emailFather || null, emailMother || null, address || null, guardian || null,
                admissionDate || null, withdrawalDate || null, withdrawalReason || null, observations || null,
                docsJson, id
            ]
        );
        return result.affectedRows > 0;
    }

    async delete(id) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [result] = await connection.query(
                `UPDATE students SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
                [id]
            );
            if (result.affectedRows > 0) {
                // Cascade: soft-delete enrollments and their grade_records
                const [enrollments] = await connection.query(
                    `SELECT id FROM enrollments WHERE student_id = ? AND deleted_at IS NULL`, [id]
                );
                for (const enr of enrollments) {
                    await connection.query(
                        `UPDATE enrollments SET deleted_at = NOW() WHERE id = ?`, [enr.id]
                    );
                    await connection.query(
                        `UPDATE grade_records SET deleted_at = NOW() WHERE enrollment_id = ? AND deleted_at IS NULL`, [enr.id]
                    );
                }
            }
            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async findById(id) {
        const [rows] = await pool.query(
            `SELECT id, last_name, first_name, full_name, student_code, birth_date, folio_number,
                    document_type, document_number, document_issue_date, document_issue_place, phone_landline, phone_mobile1, phone_mobile2,
                    email_father, email_mother, address, guardian,
                    admission_date, withdrawal_date, withdrawal_reason, observations, documents
             FROM students WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return rows[0] || null;
    }

    /**
     * Busca otro estudiante con el mismo codigo (para avisar del duplicado
     * antes de que reviente la base de datos).
     */
    async findByStudentCode(studentCode, excluirId = null) {
        const [rows] = await pool.query(
            `SELECT id FROM students
             WHERE student_code = ? AND deleted_at IS NULL AND (? IS NULL OR id <> ?)`,
            [studentCode, excluirId, excluirId]
        );
        return rows[0] || null;
    }

    /**
     * Anos lectivos donde el estudiante tiene matricula activa.
     * Sirve para renumerar folios cuando le cambian los apellidos.
     */
    async findAcademicYearIds(studentId) {
        const [rows] = await pool.query(
            `SELECT DISTINCT academic_year_id FROM enrollments
             WHERE student_id = ? AND deleted_at IS NULL`,
            [studentId]
        );
        return rows.map(r => r.academic_year_id);
    }

    async findAll() {
        const [rows] = await pool.query(
            `SELECT id, last_name, first_name, full_name, student_code, birth_date, folio_number,
                    document_type, document_number, document_issue_date, document_issue_place, phone_landline, phone_mobile1, phone_mobile2,
                    email_father, email_mother, address, guardian,
                    admission_date, withdrawal_date, withdrawal_reason, observations, documents
             FROM students WHERE deleted_at IS NULL
             ORDER BY last_name ASC, first_name ASC`
        );
        return rows;
    }

    // Returns the enrollment for a student in a given academic year (for reports)
    async findEnrollmentsByStudent(studentId, academicYearId) {
        const [rows] = await pool.query(
            `SELECT e.id, e.folio_number, e.group_id, e.academic_year_id,
                    grp.name AS group_name, grp.grade_id,
                    g.name AS grade_name, grp.head_teacher_id,
                    u.name AS head_teacher_name,
                    ay.name AS academic_year_name
             FROM enrollments e
             JOIN \`groups\` grp ON e.group_id = grp.id
             JOIN grades g ON grp.grade_id = g.id
             JOIN academic_years ay ON e.academic_year_id = ay.id
             LEFT JOIN users u ON grp.head_teacher_id = u.id
             WHERE e.student_id = ? AND e.academic_year_id = ? AND e.deleted_at IS NULL
             ORDER BY e.id DESC
             LIMIT 1`,
            [studentId, academicYearId]
        );
        return rows[0] || null;
    }

    // Returns grades organized by subject and period for the student report card
    async getStudentGradesForReport(studentId, academicYearId) {
        const [rows] = await pool.query(
            `SELECT gr.id, gr.period_id, gr.normal_note, gr.aptitudinal_note, gr.absences, gr.average,
                    p.name AS period_name, p.\`order\` AS period_order, p.percentage,
                    sub.name AS subject_name, sub.area,
                    sa.is_elective
             FROM grade_records gr
             JOIN enrollments e ON gr.enrollment_id = e.id
             JOIN subject_assignments sa ON gr.subject_assignment_id = sa.id
             JOIN subjects sub ON sa.subject_id = sub.id
             JOIN periods p ON gr.period_id = p.id
             WHERE e.student_id = ? AND e.academic_year_id = ?
               AND gr.deleted_at IS NULL AND e.deleted_at IS NULL
             ORDER BY p.\`order\`, sub.name`,
            [studentId, academicYearId]
        );
        return rows;
    }

    // Returns all students with folio, grade, and group for a given academic year
    async getAllStudentsWithFolio(academicYearId) {
        const [rows] = await pool.query(
            `SELECT s.id, s.last_name, s.first_name, s.full_name, s.student_code, e.folio_number,
                    grp.name AS group_name, g.name AS grade_name, g.id AS grade_id,
                    e.id AS enrollment_id
             FROM enrollments e
             JOIN students s ON e.student_id = s.id
             JOIN \`groups\` grp ON e.group_id = grp.id
             JOIN grades g ON grp.grade_id = g.id
             WHERE e.academic_year_id = ? AND e.deleted_at IS NULL AND s.deleted_at IS NULL
             ORDER BY ${ordenGrado('g.name')} ASC,
               grp.name ASC,
               e.folio_number ASC`,
            [academicYearId]
        );
        return rows;
    }

    // Returns students enrolled in a specific group for a given academic year
    async getStudentsByGroup(groupId, academicYearId) {
        const [rows] = await pool.query(
            `SELECT s.id, s.last_name, s.first_name, s.full_name, s.student_code, e.folio_number, e.id AS enrollment_id
             FROM enrollments e
             JOIN students s ON e.student_id = s.id
             WHERE e.group_id = ? AND e.academic_year_id = ?
               AND e.deleted_at IS NULL AND s.deleted_at IS NULL
             ORDER BY e.folio_number ASC, s.last_name ASC, s.first_name ASC`,
            [groupId, academicYearId]
        );
        return rows;
    }

    // Returns students enrolled in any group of a given grade for a given academic year
    async getStudentsByGrade(gradeId, academicYearId) {
        const [rows] = await pool.query(
            `SELECT s.id, s.last_name, s.first_name, s.full_name, s.student_code, e.folio_number,
                    grp.name AS group_name, e.id AS enrollment_id
             FROM enrollments e
             JOIN students s ON e.student_id = s.id
             JOIN \`groups\` grp ON e.group_id = grp.id
             WHERE grp.grade_id = ? AND e.academic_year_id = ?
               AND e.deleted_at IS NULL AND s.deleted_at IS NULL
             ORDER BY grp.name ASC, e.folio_number ASC, s.last_name ASC, s.first_name ASC`,
            [gradeId, academicYearId]
        );
        return rows;
    }
}

module.exports = StudentRepository;
