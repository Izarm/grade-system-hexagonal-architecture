class GetStudent {
    constructor(studentRepository) {
        this.studentRepository = studentRepository;
    }

    async execute(id) {
        const student = await this.studentRepository.findById(id);
        if (!student) {
            throw new Error('Estudiante no encontrado');
        }
        return student;
    }
}

module.exports = GetStudent;