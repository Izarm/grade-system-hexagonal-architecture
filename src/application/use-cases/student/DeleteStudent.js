class DeleteStudent {
    constructor(studentRepository) {
        this.studentRepository = studentRepository;
    }

    async execute(id) {
        const existing = await this.studentRepository.findById(id);
        if (!existing) {
            throw new Error('Estudiante no encontrado');
        }
        
        const deleted = await this.studentRepository.delete(id);
        if (!deleted) {
            throw new Error('No se pudo eliminar el estudiante');
        }
        
        return true;
    }
}

module.exports = DeleteStudent;