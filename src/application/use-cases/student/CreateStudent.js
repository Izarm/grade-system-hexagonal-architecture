class CreateStudent {
    constructor(studentRepository) {
        this.studentRepository = studentRepository;
    }

    async execute(data) {
        const { fullName, studentCode, birthDate, folioNumber } = data;
        if (!fullName || !studentCode) {
            throw new Error('Nombre y código de estudiante son obligatorios');
        }
        return await this.studentRepository.create(data);
    }
}

module.exports = CreateStudent;