class UpdateSubject {
    constructor(subjectRepository) {
        this.subjectRepository = subjectRepository;
    }

    async execute(id, data) {
        const existing = await this.subjectRepository.findById(id);
        if (!existing) throw new Error('Asignatura no encontrada');
        const { name, area } = data;
        if (!name || !area) {
            throw new Error('El nombre y el área son obligatorios');
        }
        const updated = await this.subjectRepository.update(id, { name, area });
        if (!updated) throw new Error('No se pudo actualizar');
        return { id, name, area };
    }
}

module.exports = UpdateSubject;