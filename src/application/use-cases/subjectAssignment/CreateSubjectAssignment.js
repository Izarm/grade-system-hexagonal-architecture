class CreateSubjectAssignment {
    constructor(assignmentRepository) {
        this.assignmentRepository = assignmentRepository;
    }

    async execute(data) {
        const { groupId, subjectId, teacherId, academicYearId } = data;
        if (!groupId || !subjectId || !teacherId || !academicYearId) {
            throw new Error('Faltan campos obligatorios');
        }
        const existing = await this.assignmentRepository.findUnique(groupId, subjectId, academicYearId);
        if (existing) {
            throw new Error('Ya existe una asignación de esta asignatura a este grupo en el año lectivo seleccionado');
        }
        return await this.assignmentRepository.create(data);
    }
}
module.exports = CreateSubjectAssignment;