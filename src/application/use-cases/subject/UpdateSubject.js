class UpdateSubject {
    constructor(subjectRepository) {
        this.subjectRepository = subjectRepository;
    }

    async execute(id, data) {
        const existing = await this.subjectRepository.findById(id);
        if (!existing) throw new Error('Asignatura no encontrada');
        const updated = await this.subjectRepository.update(id, data);
        if (!updated) throw new Error('No se pudo actualizar');
        return { id, ...data };
    }
}
module.exports = UpdateSubject;