class DeleteSubjectAssignment {
    constructor(assignmentRepository) {
        this.assignmentRepository = assignmentRepository;
    }

    async execute(id) {
        const existing = await this.assignmentRepository.findById(id);
        if (!existing) throw new Error('Asignación no encontrada');
        const deleted = await this.assignmentRepository.delete(id);
        if (!deleted) throw new Error('No se pudo eliminar');
        return true;
    }
}
module.exports = DeleteSubjectAssignment;