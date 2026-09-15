class TransferEnrollment {
    constructor(enrollmentRepository) {
        this.enrollmentRepository = enrollmentRepository;
    }

    async execute(enrollmentId, targetGroupId) {
        if (!enrollmentId || !targetGroupId) {
            throw new Error('Faltan campos obligatorios');
        }
        return await this.enrollmentRepository.transfer(enrollmentId, targetGroupId);
    }
}

module.exports = TransferEnrollment;
