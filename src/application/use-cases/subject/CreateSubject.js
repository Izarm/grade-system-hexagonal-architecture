class CreateSubject {
    constructor(subjectRepository) {
        this.subjectRepository = subjectRepository;
    }

    async execute(data) {
        const { name, area } = data;
        if (!name || !area) {
            throw new Error('El nombre y el área son obligatorios');
        }

        const existing = await this.subjectRepository.findByNameIncludeDeleted(name);
        if (existing) {
            if (existing.deleted_at) {
                return await this.subjectRepository.reactivate(existing.id);
            }
            throw new Error(`Ya existe una asignatura con el nombre "${name}"`);
        }

        return await this.subjectRepository.create(data);
    }
}

module.exports = CreateSubject;