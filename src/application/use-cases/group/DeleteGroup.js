class DeleteGroup {
    constructor(groupRepository) {
        this.groupRepository = groupRepository;
    }
    async execute(id) {
        const existing = await this.groupRepository.findById(id);
        if (!existing) throw new Error('Grupo no encontrado');
        const deleted = await this.groupRepository.delete(id);
        if (!deleted) throw new Error('No se pudo eliminar');
        return true;
    }
}
module.exports = DeleteGroup;