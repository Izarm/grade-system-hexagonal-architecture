class UpdateGrade {
    constructor(gradeRepository) {
        this.gradeRepository = gradeRepository;
    }
    async execute(id, name) {
        const existing = await this.gradeRepository.findById(id);
        if (!existing) throw new Error('Grado no encontrado');
        const updated = await this.gradeRepository.update(id, name);
        if (!updated) throw new Error('No se pudo actualizar');
        return { id, name };
    }
}
module.exports = UpdateGrade;