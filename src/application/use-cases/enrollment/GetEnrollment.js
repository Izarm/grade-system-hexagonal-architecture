class GetEnrollment {
    constructor(enrollmentRepository) {
        this.enrollmentRepository = enrollmentRepository;
    }

    async execute(id) {
        const enrollment = await this.enrollmentRepository.findById(id);
        if (!enrollment) throw new Error('Matrícula no encontrada');
        return enrollment;
    }
}

module.exports = GetEnrollment;