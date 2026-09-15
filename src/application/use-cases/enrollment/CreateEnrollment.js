class CreateEnrollment {
    constructor(enrollmentRepository) {
        this.enrollmentRepository = enrollmentRepository;
    }

    async execute(data) {
        const { studentId, groupId, academicYearId } = data;
        if (!studentId || !groupId || !academicYearId) {
            throw new Error('Faltan campos obligatorios');
        }
        const enrollmentValue = data.enrollmentValue ? parseInt(data.enrollmentValue) : null;
        return await this.enrollmentRepository.create({ ...data, enrollmentValue });
    }
}

module.exports = CreateEnrollment;