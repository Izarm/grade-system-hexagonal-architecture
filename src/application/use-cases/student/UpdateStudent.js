class UpdateStudent {
    constructor(studentRepository) {
        this.studentRepository = studentRepository;
    }

    async execute(id, data) {
        const existing = await this.studentRepository.findById(id);
        if (!existing) {
            throw new Error('Estudiante no encontrado');
        }
        
        const updated = await this.studentRepository.update(id, data);
        if (!updated) {
            throw new Error('No se pudo actualizar el estudiante');
        }
        
        return { id, ...data };
    }
}

module.exports = UpdateStudent;