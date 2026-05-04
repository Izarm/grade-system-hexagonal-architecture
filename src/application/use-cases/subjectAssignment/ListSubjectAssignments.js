class ListSubjectAssignments {
    constructor(assignmentRepository) {
        this.assignmentRepository = assignmentRepository;
    }

    async execute() {
        return await this.assignmentRepository.findAll();
    }
}
module.exports = ListSubjectAssignments;