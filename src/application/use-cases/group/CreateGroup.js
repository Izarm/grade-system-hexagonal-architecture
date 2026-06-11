class CreateGroup {
    constructor(groupRepository) {
        this.groupRepository = groupRepository;
    }
    async execute(data) {
        const { gradeId, name } = data;
        if (!gradeId || !name) throw new Error('Grado y nombre del grupo son obligatorios');
        return await this.groupRepository.create(data);
    }
}
module.exports = CreateGroup;