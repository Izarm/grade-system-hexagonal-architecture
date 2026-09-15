const CreateEnrollment = require('../../application/use-cases/enrollment/CreateEnrollment');
const UpdateEnrollment = require('../../application/use-cases/enrollment/UpdateEnrollment');
const DeleteEnrollment = require('../../application/use-cases/enrollment/DeleteEnrollment');
const ListEnrollments = require('../../application/use-cases/enrollment/ListEnrollments');
const GetEnrollment = require('../../application/use-cases/enrollment/GetEnrollment');
const TransferEnrollment = require('../../application/use-cases/enrollment/TransferEnrollment');
const EnrollmentRepository = require('../../infrastructure/repositories/EnrollmentRepository');

const repo = new EnrollmentRepository();
const create = new CreateEnrollment(repo);
const update = new UpdateEnrollment(repo);
const del = new DeleteEnrollment(repo);
const list = new ListEnrollments(repo);
const get = new GetEnrollment(repo);
const transfer = new TransferEnrollment(repo);

exports.create = async (req, res) => {
    try {
        const result = await create.execute(req.body);
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.update = async (req, res) => {
    try {
        const result = await update.execute(req.params.id, req.body);
        res.json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.delete = async (req, res) => {
    try {
        await del.execute(req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.list = async (req, res) => {
    try {
        const { studentId, groupId, gradeId, academicYearId } = req.query;
        let enrollments;
        
        if (studentId) {
            enrollments = await repo.findByStudent(studentId);
        } else if (gradeId) {
            // Filtrar por grado (ID del grade)
            enrollments = await repo.findByGrade(gradeId, academicYearId);
        } else if (groupId && academicYearId) {
            enrollments = await repo.findByGroupAndYear(groupId, academicYearId);
        } else {
            enrollments = await repo.findAll(academicYearId || null);
        }
        
        res.json(enrollments);
    } catch (error) {
        console.error('Error en list enrollments:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.getById = async (req, res) => {
    try {
        const enrollment = await get.execute(req.params.id);
        res.json(enrollment);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
};

exports.transfer = async (req, res) => {
    try {
        const { targetGroupId } = req.body;
        const result = await transfer.execute(req.params.id, targetGroupId);
        res.json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Subconsulta unificada: histórico migrado (2011-2024) + matrículas del sistema (2025 en adelante).
// Solo lectura — no modifica ninguna tabla.
const UNIFIED_HISTORY = `(
    SELECT student_code, student_name, grade_name, group_name, academic_year, enrollment_value
    FROM enrollment_history
    UNION ALL
    SELECT s.student_code                    AS student_code,
           s.full_name                       AS student_name,
           g.name                            AS grade_name,
           grp.name                          AS group_name,
           CAST(ay.name AS UNSIGNED)         AS academic_year,
           e.enrollment_value                AS enrollment_value
    FROM enrollments e
    JOIN students s        ON e.student_id = s.id
    JOIN \`groups\` grp     ON e.group_id = grp.id
    JOIN grades g          ON COALESCE(e.grade_id, grp.grade_id) = g.id
    JOIN academic_years ay ON e.academic_year_id = ay.id
    WHERE e.deleted_at IS NULL
)`;

// Lista de estudiantes únicos con conteo de años
exports.listHistory = async (req, res) => {
    try {
        const pool = require('../../infrastructure/database/mysql');
        const { search = '', page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const where = search ? 'WHERE student_name LIKE ? OR student_code LIKE ?' : '';
        const params = search ? [`%${search}%`, `%${search}%`] : [];

        const [[{ total }]] = await pool.query(
            `SELECT COUNT(*) as total FROM (
                SELECT student_code FROM ${UNIFIED_HISTORY} h ${where}
                GROUP BY student_code
             ) z`, params
        );
        const [rows] = await pool.query(
            `SELECT student_code,
                    MAX(student_name) as student_name,
                    COUNT(DISTINCT academic_year) as years_count,
                    MIN(academic_year) as first_year,
                    MAX(academic_year) as last_year
             FROM ${UNIFIED_HISTORY} h ${where}
             GROUP BY student_code
             ORDER BY student_name ASC
             LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );

        res.json({ data: rows, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Progresión de preescolar (no tienen número en el nombre)
const PRESCHOOL_NEXT = {
    'materno': 'Pre-Jardín',
    'pre-jardín': 'Jardín',
    'pre-jardin': 'Jardín',
    'jardín': 'Transición',
    'jardin': 'Transición',
    'transición': '1°',
    'transicion': '1°',
};

// Años disponibles para consultar matrículas: los años lectivos con matrículas
// vivas + los años del archivo histórico (enrollment_history).
exports.listYears = async (req, res) => {
    try {
        const pool = require('../../infrastructure/database/mysql');
        const [live] = await pool.query(
            `SELECT ay.id AS academic_year_id, ay.name AS year, ay.active,
                    COUNT(e.id) AS total
             FROM academic_years ay
             LEFT JOIN enrollments e ON e.academic_year_id = ay.id AND e.deleted_at IS NULL
             WHERE ay.deleted_at IS NULL
             GROUP BY ay.id, ay.name, ay.active`
        );
        const [legacy] = await pool.query(
            `SELECT academic_year AS year, COUNT(*) AS total
             FROM enrollment_history GROUP BY academic_year`
        );

        const map = new Map();
        for (const l of live) {
            map.set(String(l.year), {
                year: String(l.year),
                academicYearId: l.academic_year_id,
                active: !!l.active,
                live: true,
                total: l.total,
            });
        }
        for (const g of legacy) {
            const key = String(g.year);
            if (!map.has(key)) {
                map.set(key, { year: key, academicYearId: null, active: false, live: false, total: g.total });
            }
        }
        const years = [...map.values()].sort((a, b) => Number(b.year) - Number(a.year));
        res.json(years);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Matrículas de un año concreto. Si el año tiene matrículas vivas devuelve las
// filas editables (con enrollment_id); si es un año del archivo, solo lectura.
exports.listByYear = async (req, res) => {
    try {
        const pool = require('../../infrastructure/database/mysql');
        const { year } = req.query;
        if (!year) return res.status(400).json({ message: 'Falta year' });

        const [[ay]] = await pool.query(
            `SELECT id, active FROM academic_years
             WHERE name = ? AND deleted_at IS NULL LIMIT 1`, [String(year)]
        );

        if (ay) {
            const [rows] = await pool.query(
                `SELECT e.id AS enrollment_id, e.student_id, e.group_id,
                        s.full_name AS student_name, s.student_code,
                        g.name AS grade_name, grp.name AS group_name,
                        e.folio_number, e.enrollment_value
                 FROM enrollments e
                 JOIN students s ON e.student_id = s.id
                 JOIN \`groups\` grp ON e.group_id = grp.id
                 JOIN grades g ON COALESCE(e.grade_id, grp.grade_id) = g.id
                 WHERE e.academic_year_id = ? AND e.deleted_at IS NULL
                 ORDER BY CAST(g.name AS UNSIGNED), g.name, grp.name, s.full_name`,
                [ay.id]
            );
            if (rows.length > 0 || !!ay.active) {
                return res.json({ year: String(year), editable: !!ay.active, rows });
            }
        }

        // Año del archivo histórico (solo lectura)
        const [rows] = await pool.query(
            `SELECT NULL AS enrollment_id, NULL AS student_id, NULL AS group_id,
                    student_name, student_code, grade_name, group_name,
                    NULL AS folio_number, enrollment_value
             FROM enrollment_history
             WHERE academic_year = ?
             ORDER BY CAST(grade_name AS UNSIGNED), grade_name, group_name, student_name`,
            [Number(year)]
        );
        res.json({ year: String(year), editable: false, rows });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// "1°" -> "2°" ; preescolar sigue la cadena; 11° no tiene siguiente (egresa).
function nextGradeName(gradeName) {
    const raw = String(gradeName || '').trim();
    const pre = PRESCHOOL_NEXT[raw.toLowerCase()];
    if (pre) return pre;
    const m = raw.match(/\d+/);
    if (!m) return null;
    const n = parseInt(m[0], 10);
    if (n >= 11) return null; // 11° egresa: sin grado siguiente
    return raw.replace(/\d+/, String(n + 1));
}

// Candidatos a matricular en el año nuevo: estudiantes del año anterior que
// aún no tienen matrícula en el año destino, con su grado anterior y una
// sugerencia del grado siguiente (el admin puede cambiarla).
exports.newYearCandidates = async (req, res) => {
    try {
        const pool = require('../../infrastructure/database/mysql');
        const { toYearId } = req.query;
        let { fromYearId } = req.query;
        if (!toYearId) return res.status(400).json({ message: 'Falta toYearId' });

        // Año origen: el más reciente anterior al destino que tenga matrículas
        if (!fromYearId) {
            const [[prev]] = await pool.query(
                `SELECT ay.id FROM academic_years ay
                 WHERE ay.deleted_at IS NULL AND ay.id <> ?
                   AND EXISTS (SELECT 1 FROM enrollments e
                               WHERE e.academic_year_id = ay.id AND e.deleted_at IS NULL)
                 ORDER BY CAST(ay.name AS UNSIGNED) DESC LIMIT 1`,
                [toYearId]
            );
            fromYearId = prev?.id || null;
        }

        // Grupos disponibles en el año destino
        const [targetGroups] = await pool.query(
            `SELECT grp.id, grp.name AS group_name, g.id AS grade_id, g.name AS grade_name
             FROM \`groups\` grp
             JOIN grades g ON grp.grade_id = g.id
             WHERE g.academic_year_id = ? AND g.deleted_at IS NULL AND grp.deleted_at IS NULL
             ORDER BY CAST(g.name AS UNSIGNED), grp.name`,
            [toYearId]
        );

        if (!fromYearId) {
            return res.json({ fromYearId: null, fromYearName: null, students: [], targetGroups });
        }

        const [[fromYear]] = await pool.query(
            'SELECT name FROM academic_years WHERE id = ?', [fromYearId]
        );

        const [students] = await pool.query(
            `SELECT e.student_id, s.full_name, s.student_code, e.promotion_status,
                    g.name AS prev_grade_name, grp.name AS prev_group_name
             FROM enrollments e
             JOIN students s ON e.student_id = s.id AND s.deleted_at IS NULL
             JOIN \`groups\` grp ON e.group_id = grp.id
             JOIN grades g ON COALESCE(e.grade_id, grp.grade_id) = g.id
             WHERE e.academic_year_id = ? AND e.deleted_at IS NULL
               AND NOT EXISTS (
                   SELECT 1 FROM enrollments e2
                   WHERE e2.student_id = e.student_id
                     AND e2.academic_year_id = ? AND e2.deleted_at IS NULL
               )
             ORDER BY CAST(g.name AS UNSIGNED), grp.name, s.full_name`,
            [fromYearId, toYearId]
        );

        // Sugerencia: mismo grado +1 y, si existe, la misma sección (A→A)
        const byGradeName = {};
        for (const t of targetGroups) {
            (byGradeName[t.grade_name] = byGradeName[t.grade_name] || []).push(t);
        }
        const withSuggestion = students.map(st => {
            const next = nextGradeName(st.prev_grade_name);
            const opts = next ? byGradeName[next] : null;
            let suggested = null;
            if (opts && opts.length) {
                const same = opts.find(o => o.group_name === st.prev_group_name);
                suggested = (same || opts[0]).id;
            }
            return { ...st, next_grade_name: next, suggested_group_id: suggested };
        });

        res.json({
            fromYearId, fromYearName: fromYear?.name || null,
            students: withSuggestion, targetGroups
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Matrícula en lote para el año nuevo
exports.bulkCreate = async (req, res) => {
    const pool = require('../../infrastructure/database/mysql');
    const connection = await pool.getConnection();
    try {
        const { academicYearId, items } = req.body;
        if (!academicYearId || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Se requieren academicYearId e items' });
        }
        await connection.beginTransaction();

        let created = 0, skipped = 0;

        for (const it of items) {
            if (!it.studentId || !it.groupId) { skipped++; continue; }
            const [[exists]] = await connection.query(
                `SELECT id FROM enrollments
                 WHERE student_id = ? AND academic_year_id = ? AND deleted_at IS NULL`,
                [it.studentId, academicYearId]
            );
            if (exists) { skipped++; continue; }

            const [[grp]] = await connection.query(
                'SELECT grade_id FROM `groups` WHERE id = ? AND deleted_at IS NULL', [it.groupId]
            );
            if (!grp) { skipped++; continue; }

            await connection.query(
                `INSERT INTO enrollments (student_id, group_id, grade_id, academic_year_id, enrollment_value)
                 VALUES (?, ?, ?, ?, ?)`,
                [it.studentId, it.groupId, grp.grade_id, academicYearId, it.enrollmentValue || null]
            );
            created++;
        }

        // Recalcular folios del año: numera solo los grados con número y deja
        // sin folio a preescolar.
        if (created > 0) {
            const EnrollmentRepository = require('../../infrastructure/repositories/EnrollmentRepository');
            await new EnrollmentRepository().recalculateFolioNumbers(academicYearId, connection);
        }

        await connection.commit();
        res.json({ created, skipped, message: `${created} estudiante(s) matriculado(s)` });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

// Estudiantes SIN matrícula en el año activo (egresados / no matriculados).
// Formato liviano: solo datos de la ficha + resumen de su historial.
exports.listUnenrolled = async (req, res) => {
    try {
        const pool = require('../../infrastructure/database/mysql');
        const { academicYearId, search = '' } = req.query;
        if (!academicYearId) return res.status(400).json({ message: 'Falta academicYearId' });

        const params = [parseInt(academicYearId)];
        let searchWhere = '';
        if (search) {
            searchWhere = 'AND (s.full_name LIKE ? OR s.student_code LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        // El resumen de historial (conteo, último año, último grado) se calcula
        // sobre el historial UNIFICADO (matrículas vivas + tabla legada), enlazando
        // por student_code, para que los egresados con historial antiguo salgan bien.
        const [rows] = await pool.query(
            `SELECT s.id, s.full_name, s.student_code, s.document_type,
                    s.admission_date, s.withdrawal_date, s.withdrawal_reason,
                    COALESCE(hist.enrollment_count, 0) AS enrollment_count,
                    hist.last_year AS last_year,
                    hist.last_grade AS last_grade
             FROM students s
             LEFT JOIN (
                 SELECT student_code,
                        COUNT(*) AS enrollment_count,
                        MAX(academic_year) AS last_year,
                        SUBSTRING_INDEX(
                            GROUP_CONCAT(grade_name ORDER BY academic_year DESC SEPARATOR '||'),
                            '||', 1) AS last_grade
                 FROM ${UNIFIED_HISTORY} h
                 GROUP BY student_code
             ) hist ON hist.student_code = s.student_code
             WHERE s.deleted_at IS NULL
               AND NOT EXISTS (
                   SELECT 1 FROM enrollments e
                   WHERE e.student_id = s.id AND e.academic_year_id = ? AND e.deleted_at IS NULL
               )
               ${searchWhere}
             ORDER BY s.full_name ASC`,
            params
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Detalle completo de un estudiante
exports.studentHistory = async (req, res) => {
    try {
        const pool = require('../../infrastructure/database/mysql');
        const { code } = req.params;
        const [rows] = await pool.query(
            `SELECT academic_year, grade_name, group_name, enrollment_value
             FROM ${UNIFIED_HISTORY} h
             WHERE student_code = ?
             ORDER BY academic_year ASC`,
            [code]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
