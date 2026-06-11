class UpdateEnrollment {
    constructor(enrollmentRepository) {
        this.enrollmentRepository = enrollmentRepository;
    }

    async execute(id, data) {
        const existing = await this.enrollmentRepository.findById(id);
        if (!existing) throw new Error('Matrícula no encontrada');
        
        const updated = await this.enrollmentRepository.update(id, data);
        if (!updated) throw new Error('No se pudo actualizar');
        
        return { id, ...data };
    }
}

module.exports = UpdateEnrollment;