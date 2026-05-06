class DeleteSubject {
    constructor(subjectRepository) {
        this.subjectRepository = subjectRepository;
    }

    async execute(id) {
        const existing = await this.subjectRepository.findById(id);
        if (!existing) throw new Error('Asignatura no encontrada');
        const deleted = await this.subjectRepository.delete(id);
        if (!deleted) throw new Error('No se pudo eliminar');
        return true;
    }
}
module.exports = DeleteSubject;