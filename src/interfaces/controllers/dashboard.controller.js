const pool = require('../../infrastructure/database/mysql');

exports.getDashboardStats = async (req, res) => {
    try {
        const userRole = req.user.role;
        const userId = req.user.id;
        
        // 1. Obtener año activo
        const [activeYear] = await pool.query(
            `SELECT id, name FROM academic_years WHERE active = 1 AND deleted_at IS NULL LIMIT 1`
        );
        
        const academicYearId = activeYear[0]?.id || null;
        const academicYearName = activeYear[0]?.name || 'No hay año activo';
        
        // 2. Estadísticas generales
        const [studentCount] = await pool.query(
            `SELECT COUNT(*) as total FROM students WHERE deleted_at IS NULL`
        );
        
        const [teacherCount] = await pool.query(
            `SELECT COUNT(*) as total FROM users WHERE role = 'docente' AND deleted_at IS NULL`
        );
        
        const [subjectCount] = await pool.query(
            `SELECT COUNT(*) as total FROM subjects WHERE deleted_at IS NULL`
        );
        
        const [gradeCount] = await pool.query(
            `SELECT COUNT(*) as total FROM grades WHERE deleted_at IS NULL`
        );
        
        // 3. Estadísticas de matrículas (año activo)
        let activeEnrollments = 0;
        let studentsByGrade = [];
        
        if (academicYearId) {
            const [enrollmentCount] = await pool.query(
                `SELECT COUNT(*) as total FROM enrollments 
                 WHERE academic_year_id = ? AND deleted_at IS NULL`,
                [academicYearId]
            );
            activeEnrollments = enrollmentCount[0]?.total || 0;
            
            // Estudiantes por grado
            const [gradeDistribution] = await pool.query(
                `SELECT g.name as grade_name, COUNT(e.id) as student_count
                 FROM enrollments e
                 JOIN \`groups\` grp ON e.group_id = grp.id
                 JOIN grades g ON grp.grade_id = g.id
                 WHERE e.academic_year_id = ? AND e.deleted_at IS NULL
                 GROUP BY g.id, g.name
                 ORDER BY g.name`,
                [academicYearId]
            );
            studentsByGrade = gradeDistribution || [];
        }
        
        // 4. Estadísticas de rendimiento (año activo)
        let averageScore = null;
        let highPerformance = 0;
        let atRisk = 0;
        let topStudents = [];
        let failingSubjects = [];
        
        if (academicYearId) {
            // Promedio general de notas
            const [avgResult] = await pool.query(
                `SELECT AVG(
                    CASE 
                        WHEN gr.normal_note IS NOT NULL AND gr.normal_note != '' 
                        THEN CAST(gr.normal_note AS DECIMAL(4,2))
                        ELSE NULL 
                    END
                 ) as avg_score
                 FROM grade_records gr
                 JOIN enrollments e ON gr.enrollment_id = e.id
                 WHERE e.academic_year_id = ? AND gr.deleted_at IS NULL`,
                [academicYearId]
            );
            averageScore = avgResult[0]?.avg_score ? parseFloat(avgResult[0].avg_score).toFixed(2) : null;
            
            // Estudiantes de alto rendimiento (promedio >= 7.8 — desempeño Alto o Superior)
            const [highResult] = await pool.query(
                `SELECT COUNT(DISTINCT e.student_id) as total
                 FROM grade_records gr
                 JOIN enrollments e ON gr.enrollment_id = e.id
                 WHERE e.academic_year_id = ?
                   AND gr.average >= 7.8
                   AND gr.deleted_at IS NULL`,
                [academicYearId]
            );
            highPerformance = highResult[0]?.total || 0;

            // Estudiantes en riesgo (promedio < 6.5 — desempeño Bajo)
            const [riskResult] = await pool.query(
                `SELECT COUNT(DISTINCT e.student_id) as total
                 FROM grade_records gr
                 JOIN enrollments e ON gr.enrollment_id = e.id
                 WHERE e.academic_year_id = ?
                   AND gr.average < 6.5
                   AND gr.deleted_at IS NULL`,
                [academicYearId]
            );
            atRisk = riskResult[0]?.total || 0;
            
            // Top 5 mejores estudiantes
            const [topStudentsResult] = await pool.query(
                `SELECT s.id, s.full_name, s.student_code, AVG(gr.average) as avg_score
                 FROM grade_records gr
                 JOIN enrollments e ON gr.enrollment_id = e.id
                 JOIN students s ON e.student_id = s.id
                 WHERE e.academic_year_id = ? AND gr.deleted_at IS NULL AND gr.average IS NOT NULL
                 GROUP BY s.id, s.full_name, s.student_code
                 ORDER BY avg_score DESC
                 LIMIT 5`,
                [academicYearId]
            );
            topStudents = topStudentsResult || [];
            
            // Materias con más bajo rendimiento
            const [failingResult] = await pool.query(
                `SELECT sub.name as subject_name, AVG(gr.average) as avg_score
                 FROM grade_records gr
                 JOIN subject_assignments sa ON gr.subject_assignment_id = sa.id
                 JOIN subjects sub ON sa.subject_id = sub.id
                 WHERE gr.deleted_at IS NULL AND gr.average IS NOT NULL
                 GROUP BY sub.id, sub.name
                 ORDER BY avg_score ASC
                 LIMIT 5`,
                []
            );
            failingSubjects = failingResult || [];
        }
        
        // 5. Estadísticas de faltas
        let totalAbsences = 0;
        let studentMostAbsences = null;
        
        if (academicYearId) {
            const [absencesResult] = await pool.query(
                `SELECT SUM(gr.absences) as total_absences
                 FROM grade_records gr
                 JOIN enrollments e ON gr.enrollment_id = e.id
                 WHERE e.academic_year_id = ? AND gr.deleted_at IS NULL`,
                [academicYearId]
            );
            totalAbsences = absencesResult[0]?.total_absences || 0;
            
            const [mostAbsences] = await pool.query(
                `SELECT s.id, s.full_name, s.student_code, SUM(gr.absences) as total_absences
                 FROM grade_records gr
                 JOIN enrollments e ON gr.enrollment_id = e.id
                 JOIN students s ON e.student_id = s.id
                 WHERE e.academic_year_id = ? AND gr.deleted_at IS NULL AND gr.absences > 0
                 GROUP BY s.id, s.full_name, s.student_code
                 ORDER BY total_absences DESC
                 LIMIT 1`,
                [academicYearId]
            );
            studentMostAbsences = mostAbsences[0] || null;
        }
        
        // 6. Alertas
        const alerts = [];
        
        // Alertas de bajo rendimiento
        if (atRisk > 0) {
            alerts.push({
                type: 'warning',
                title: 'Estudiantes en riesgo',
                message: `${atRisk} estudiante(s) tienen promedio menor a 6.5 (Desempeño Bajo)`,
                severity: 'high'
            });
        }
        
        // Alertas de grados sin director
        const [gradesWithoutHead] = await pool.query(
            `SELECT COUNT(*) as total FROM grades WHERE head_teacher_id IS NULL AND deleted_at IS NULL`
        );
        if (gradesWithoutHead[0]?.total > 0) {
            alerts.push({
                type: 'info',
                title: 'Grados sin director',
                message: `${gradesWithoutHead[0].total} grado(s) no tienen director asignado`,
                severity: 'medium'
            });
        }
        
        // Alertas de estudiantes con muchas faltas
        if (studentMostAbsences && studentMostAbsences.total_absences > 20) {
            alerts.push({
                type: 'warning',
                title: 'Faltas excesivas',
                message: `${studentMostAbsences.full_name} tiene ${studentMostAbsences.total_absences} faltas`,
                severity: 'high'
            });
        }

        // Alertas de períodos (próximos a vencer y vencidos)
        if (academicYearId) {
            const [periodAlerts] = await pool.query(
                `SELECT id, name, \`order\`, start_date, end_date, status
                 FROM periods
                 WHERE academic_year_id = ? AND deleted_at IS NULL
                 ORDER BY \`order\` ASC`,
                [academicYearId]
            );

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;

            for (const period of periodAlerts) {
                const endDate = new Date(period.end_date);
                endDate.setHours(0, 0, 0, 0);
                const startDate = new Date(period.start_date);
                startDate.setHours(0, 0, 0, 0);
                const daysToEnd = Math.round((endDate - today) / (24 * 60 * 60 * 1000));

                if (period.status === 'open') {
                    if (today > endDate) {
                        // Período vencido y aún abierto
                        alerts.push({
                            type: 'danger',
                            title: `⚠ Período ${period.order} vencido`,
                            message: `"${period.name}" venció el ${endDate.toLocaleDateString('es-CO')}. Debes cerrarlo y abrir el siguiente.`,
                            severity: 'high'
                        });
                    } else if ((endDate - today) <= TWO_WEEKS) {
                        // Faltan 2 semanas o menos
                        alerts.push({
                            type: 'warning',
                            title: `📋 Período ${period.order} próximo a cerrar`,
                            message: `"${period.name}" cierra el ${endDate.toLocaleDateString('es-CO')} (${daysToEnd} día${daysToEnd !== 1 ? 's' : ''}). Es momento de subir las notas.`,
                            severity: daysToEnd <= 3 ? 'high' : 'medium'
                        });
                    }
                }
            }
        }

        // 7. Matrículas nuevas (comparativa)
        let newEnrollments = 0;
        let previousEnrollments = 0;
        let growthRate = 0;
        
        if (academicYearId) {
            const [currentYearEnrollments] = await pool.query(
                `SELECT COUNT(*) as total FROM enrollments WHERE academic_year_id = ? AND deleted_at IS NULL`,
                [academicYearId]
            );
            
            const [prevYear] = await pool.query(
                `SELECT id FROM academic_years WHERE id < ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1`,
                [academicYearId]
            );
            
            if (prevYear[0]) {
                const [prevEnrollmentsResult] = await pool.query(
                    `SELECT COUNT(*) as total FROM enrollments WHERE academic_year_id = ? AND deleted_at IS NULL`,
                    [prevYear[0].id]
                );
                previousEnrollments = prevEnrollmentsResult[0]?.total || 0;
                newEnrollments = currentYearEnrollments[0]?.total - previousEnrollments;
                growthRate = previousEnrollments > 0 
                    ? ((newEnrollments / previousEnrollments) * 100).toFixed(1) 
                    : 0;
            }
        }
        
        // 8. Porcentaje de ocupación por grado
        const gradeOccupancy = (studentsByGrade || []).map(grade => {
            const capacity = 40;
            const occupancy = Math.round((grade.student_count / capacity) * 100);
            return {
                grade_name: grade.grade_name,
                student_count: grade.student_count,
                capacity: capacity,
                occupancy: occupancy > 100 ? 100 : occupancy
            };
        });
        
        // 9. Rendimiento por grado
        let performanceByGrade = [];
        if (academicYearId) {
            const [gradePerformance] = await pool.query(
                `SELECT 
                    g.name as grade_name,
                    COUNT(DISTINCT e.student_id) as student_count,
                    COALESCE(AVG(CAST(gr.normal_note AS DECIMAL(4,2))), 0) as avg_score,
                    COALESCE(SUM(CASE WHEN gr.average >= 7.8 THEN 1 ELSE 0 END), 0) as high_performance,
                    COALESCE(SUM(CASE WHEN gr.average < 6.5 THEN 1 ELSE 0 END), 0) as at_risk
                 FROM grade_records gr
                 JOIN enrollments e ON gr.enrollment_id = e.id
                 JOIN \`groups\` grp ON e.group_id = grp.id
                 JOIN grades g ON grp.grade_id = g.id
                 WHERE e.academic_year_id = ? 
                   AND gr.deleted_at IS NULL
                   AND gr.normal_note IS NOT NULL
                 GROUP BY g.id, g.name
                 ORDER BY avg_score DESC`,
                [academicYearId]
            );
            performanceByGrade = gradePerformance || [];
        }
        
        // Respuesta final
        return res.status(200).json({
            success: true,
            data: {
                academicYear: {
                    id: academicYearId,
                    name: academicYearName,
                    isActive: academicYearId !== null
                },
                cards: {
                    students: studentCount[0]?.total || 0,
                    teachers: teacherCount[0]?.total || 0,
                    subjects: subjectCount[0]?.total || 0,
                    grades: gradeCount[0]?.total || 0,
                    activeEnrollments: activeEnrollments || 0
                },
                enrollmentStats: {
                    newEnrollments: newEnrollments > 0 ? newEnrollments : 0,
                    previousEnrollments: previousEnrollments || 0,
                    growthRate: growthRate || 0,
                    studentsByGrade: studentsByGrade || [],
                    gradeOccupancy: gradeOccupancy || []
                },
                performanceStats: {
                    averageScore: averageScore,
                    highPerformance: highPerformance || 0,
                    atRisk: atRisk || 0,
                    topStudents: topStudents || [],
                    failingSubjects: failingSubjects || []
                },
                attendanceStats: {
                    totalAbsences: totalAbsences || 0,
                    studentMostAbsences: studentMostAbsences
                },
                alerts: alerts || [],
                performanceByGrade: performanceByGrade || []
            }
        });
        
    } catch (error) {
        console.error('Error en getDashboardStats:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Error al obtener estadísticas del dashboard',
            error: error.message 
        });
    }
};