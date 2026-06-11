class ListEnrollments {
    constructor(enrollmentRepository) {
        this.enrollmentRepository = enrollmentRepository;
    }

    async execute() {
        return await this.enrollmentRepository.findAll();
    }
}

module.exports = ListEnrollments;