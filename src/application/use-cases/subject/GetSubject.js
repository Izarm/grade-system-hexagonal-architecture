class GetSubject {
    constructor(subjectRepository) {
        this.subjectRepository = subjectRepository;
    }

    async execute(id) {
        const subject = await this.subjectRepository.findById(id);
        if (!subject) throw new Error('Asignatura no encontrada');
        return subject;
    }
}
module.exports = GetSubject;