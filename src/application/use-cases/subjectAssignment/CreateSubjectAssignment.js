class CreateSubjectAssignment {
    constructor(assignmentRepository) {
        this.assignmentRepository = assignmentRepository;
    }

    async execute(data) {
        const { groupId, subjectId, teacherId, academicYearId, isElective, weeklyHours } = data;

        if (weeklyHours !== undefined && weeklyHours !== null && weeklyHours !== '') {
            const hours = parseInt(weeklyHours);
            if (isNaN(hours) || hours < 1 || hours > 40) {
                throw new Error('La intensidad horaria debe ser un número entre 1 y 40');
            }
        }
        
        // Validaciones básicas
        if (!subjectId || !teacherId || !academicYearId) {
            throw new Error('Faltan campos obligatorios: subjectId, teacherId, academicYearId');
        }
        
        // Para asignaciones no electivas (regulares), se requiere grupo
        if (!isElective && !groupId) {
            throw new Error('Para asignaciones regulares, debe seleccionar un grupo');
        }

        // Los grados de solo matrícula (preescolar) no llevan notas: no se pueden asignar materias
        if (!isElective && groupId) {
            const pool = require('../../../infrastructure/database/mysql');
            const [rows] = await pool.query(
                `SELECT gr.takes_grades, gr.name
                 FROM \`groups\` g JOIN grades gr ON g.grade_id = gr.id
                 WHERE g.id = ?`,
                [groupId]
            );
            if (rows[0] && rows[0].takes_grades === 0) {
                throw new Error(`El grado ${rows[0].name} es de solo matrícula y no lleva notas, no se le pueden asignar materias`);
            }
        }

        // Verificar duplicados solo para asignaciones regulares
        if (!isElective && groupId) {
            const existing = await this.assignmentRepository.findUnique(groupId, subjectId, academicYearId);
            if (existing) {
                throw new Error('Ya existe una asignación de esta asignatura a este grupo en el año lectivo seleccionado');
            }
        }
        
        // Para electivas, verificar si ya existe una asignación del mismo docente para la misma materia
        if (isElective) {
            const existingElective = await this.assignmentRepository.findByTeacherAndSubject(teacherId, subjectId, academicYearId);
            if (existingElective && existingElective.length > 0) {
                throw new Error('El docente ya tiene asignada esta materia electiva en el año lectivo');
            }
        }
        
        return await this.assignmentRepository.create(data);
    }
}

module.exports = CreateSubjectAssignment;