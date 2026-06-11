class CreateEnrollment {
    constructor(enrollmentRepository) {
        this.enrollmentRepository = enrollmentRepository;
    }

    async execute(data) {
        const { studentId, groupId, academicYearId } = data;
        if (!studentId || !groupId || !academicYearId) {
            throw new Error('Faltan campos obligatorios');
        }
        return await this.enrollmentRepository.create(data);
    }
}

module.exports = CreateEnrollment;