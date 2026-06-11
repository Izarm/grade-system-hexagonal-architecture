const pool = require('../../infrastructure/database/mysql');

exports.getReviews = async (req, res) => {
    try {
        const { studentId, periodId, academicYearId } = req.query;
        
        let query = `
            SELECT id, student_id, period_id, academic_year_id, review
            FROM head_teacher_reviews
            WHERE 1=1
        `;
        const params = [];
        
        if (studentId) {
            query += ` AND student_id = ?`;
            params.push(studentId);
        }
        if (req.query.isFinal === 'true') {
            query += ` AND period_id IS NULL`;
        } else if (periodId) {
            query += ` AND period_id = ?`;
            params.push(periodId);
        }
        if (academicYearId) {
            query += ` AND academic_year_id = ?`;
            params.push(academicYearId);
        }
        
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error en getReviews:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.saveReview = async (req, res) => {
    try {
        const { studentId, periodId, academicYearId, review } = req.body;
        // periodId = null means "final report" review
        const pid = (periodId === null || periodId === undefined || periodId === 0 || periodId === '0') ? null : periodId;

        // Upsert: if period_id IS NULL use a separate condition
        if (pid === null) {
            const [existing] = await pool.query(
                `SELECT id FROM head_teacher_reviews WHERE student_id = ? AND period_id IS NULL AND academic_year_id = ?`,
                [studentId, academicYearId]
            );
            if (existing.length > 0) {
                await pool.query(
                    `UPDATE head_teacher_reviews SET review = ?, updated_at = NOW() WHERE id = ?`,
                    [review, existing[0].id]
                );
            } else {
                await pool.query(
                    `INSERT INTO head_teacher_reviews (student_id, period_id, academic_year_id, review) VALUES (?, NULL, ?, ?)`,
                    [studentId, academicYearId, review]
                );
            }
        } else {
            await pool.query(
                `INSERT INTO head_teacher_reviews (student_id, period_id, academic_year_id, review)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE review = ?, updated_at = NOW()`,
                [studentId, pid, academicYearId, review, review]
            );
        }
        
        res.json({ success: true, message: 'Reseña guardada correctamente' });
    } catch (error) {
        console.error('Error en saveReview:', error);
        res.status(500).json({ message: error.message });
    }
};