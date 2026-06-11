class GetSubjectAssignment {
    constructor(assignmentRepository) {
        this.assignmentRepository = assignmentRepository;
    }

    async execute(id) {
        const assignment = await this.assignmentRepository.findById(id);
        if (!assignment) throw new Error('Asignación no encontrada');
        return assignment;
    }
}
module.exports = GetSubjectAssignment;