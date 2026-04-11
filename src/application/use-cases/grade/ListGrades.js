class ListGrades {
    constructor(gradeRepository) {
        this.gradeRepository = gradeRepository;
    }
    async execute() {
        return await this.gradeRepository.findAll();
    }
}
module.exports = ListGrades;