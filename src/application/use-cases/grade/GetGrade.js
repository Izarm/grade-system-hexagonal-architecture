class GetGrade {
    constructor(gradeRepository) {
        this.gradeRepository = gradeRepository;
    }
    async execute(id) {
        const grade = await this.gradeRepository.findById(id);
        if (!grade) throw new Error('Grado no encontrado');
        return grade;
    }
}
module.exports = GetGrade;