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
        // Check that no OTHER active subject already has this name
        // (la comparacion en BD es insensible a mayusculas, asi que un cambio de
        // solo la capitalizacion del propio nombre no debe contar como conflicto)
        if (name !== existing.name) {
            const conflict = await this.subjectRepository.findByNameIncludeDeleted(name);
            if (conflict && conflict.id != id && !conflict.deleted_at) {
                throw new Error(`Ya existe una asignatura activa con el nombre "${name}"`);
            }
        }
        const updated = await this.subjectRepository.update(id, { name, area });
        if (!updated) throw new Error('No se pudo actualizar');
        return { id, name, area };
    }
}

module.exports = UpdateSubject;