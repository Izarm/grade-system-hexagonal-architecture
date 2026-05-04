class CreateSubject {
    constructor(subjectRepository) {
        this.subjectRepository = subjectRepository;
    }

    async execute(data) {
        const { name, area, intensityHours } = data;
        if (!name || !area || intensityHours === undefined) {
            throw new Error('Faltan campos obligatorios: nombre, área e intensidad horaria');
        }
        if (intensityHours < 1 || intensityHours > 10) {
            throw new Error('La intensidad horaria debe estar entre 1 y 10 horas semanales');
        }
        return await this.subjectRepository.create(data);
    }
}
module.exports = CreateSubject;