class CreateGrade {
    constructor(gradeRepository) {
        this.gradeRepository = gradeRepository;
    }
    async execute(name) {
        if (!name) throw new Error('El nombre del grado es obligatorio');
        return await this.gradeRepository.create(name);
    }
}
module.exports = CreateGrade;