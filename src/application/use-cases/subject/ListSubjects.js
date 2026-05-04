class ListSubjects {
    constructor(subjectRepository) {
        this.subjectRepository = subjectRepository;
    }

    async execute() {
        return await this.subjectRepository.findAll();
    }
}
module.exports = ListSubjects;