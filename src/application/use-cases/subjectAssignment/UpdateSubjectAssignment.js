class UpdateSubjectAssignment {
    constructor(assignmentRepository) {
        this.assignmentRepository = assignmentRepository;
    }

    async execute(id, data) {
        const existing = await this.assignmentRepository.findById(id);
        if (!existing) throw new Error('Asignación no encontrada');
        const { groupId, subjectId, teacherId, academicYearId } = data;
        if (groupId !== existing.groupId || subjectId !== existing.subjectId || academicYearId !== existing.academicYearId) {
            const conflict = await this.assignmentRepository.findUnique(groupId, subjectId, academicYearId);
            if (conflict && conflict.id != id) {
                throw new Error('Ya existe otra asignación con esos datos');
            }
        }
        const updated = await this.assignmentRepository.update(id, data);
        if (!updated) throw new Error('No se pudo actualizar');
        return { id, ...data };
    }
}
module.exports = UpdateSubjectAssignment;