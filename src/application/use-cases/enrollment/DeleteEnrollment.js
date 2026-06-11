class DeleteEnrollment {
    constructor(enrollmentRepository) {
        this.enrollmentRepository = enrollmentRepository;
    }

    async execute(id) {
        const existing = await this.enrollmentRepository.findById(id);
        if (!existing) throw new Error('Matrícula no encontrada');
        
        return await this.enrollmentRepository.delete(id);
    }
}

module.exports = DeleteEnrollment;