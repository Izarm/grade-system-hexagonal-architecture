class GetTeacherAssignments {
    constructor(subjectAssignmentRepository) {
        this.subjectAssignmentRepository = subjectAssignmentRepository;
    }

    async execute(teacherId, academicYearId) {
        if (!teacherId || !academicYearId) throw new Error('Faltan parámetros');
        return await this.subjectAssignmentRepository.findByTeacherAndYear(teacherId, academicYearId);
    }
}
module.exports = GetTeacherAssignments;