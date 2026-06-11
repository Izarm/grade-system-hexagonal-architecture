class UpdateGroup {
    constructor(groupRepository) {
        this.groupRepository = groupRepository;
    }
    async execute(id, data) {
        const existing = await this.groupRepository.findById(id);
        if (!existing) throw new Error('Grupo no encontrado');
        const updated = await this.groupRepository.update(id, data);
        if (!updated) throw new Error('No se pudo actualizar');
        return { id, ...data };
    }
}
module.exports = UpdateGroup;