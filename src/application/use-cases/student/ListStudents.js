class ListStudents {
    constructor(studentRepository) {
        this.studentRepository = studentRepository;
    }

    async execute() {
        return await this.studentRepository.findAll();
    }
}

module.exports = ListStudents;