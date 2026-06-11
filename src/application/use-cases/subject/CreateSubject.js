class CreateSubject {
    constructor(subjectRepository) {
        this.subjectRepository = subjectRepository;
    }

    async execute(data) {
        const { name, area } = data;
        if (!name || !area) {
            throw new Error('El nombre y el área son obligatorios');
        }
        return await this.subjectRepository.create(data);
    }
}

module.exports = CreateSubject;