class DeleteGrade {
    constructor(gradeRepository) {
        this.gradeRepository = gradeRepository;
    }
    async execute(id) {
        const existing = await this.gradeRepository.findById(id);
        if (!existing) throw new Error('Grado no encontrado');
        const deleted = await this.gradeRepository.delete(id);
        if (!deleted) throw new Error('No se pudo eliminar');
        return true;
    }
}
module.exports = DeleteGrade;   