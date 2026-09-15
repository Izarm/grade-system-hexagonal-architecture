class CreateGrade {
    constructor(gradeRepository) {
        this.gradeRepository = gradeRepository;
    }

    async execute(name, students = [], academicYearId = null) {
        if (!name || name.trim() === '') {
            throw new Error('El nombre del grado es obligatorio');
        }

        // Verificar unicidad por nombre dentro del mismo año lectivo
        const existing = await this.gradeRepository.findByNameIncludeDeleted(name, academicYearId);
        let grade;

        if (existing) {
            if (existing.deleted_at) {
                grade = await this.gradeRepository.reactivate(existing.id);
                grade = await this.gradeRepository.findById(existing.id);
            } else {
                throw new Error(`Ya existe un grado con el nombre "${name}"`);
            }
        } else {
            grade = await this.gradeRepository.create(name, academicYearId);
        }

        if (students && students.length > 0) {
            await this.gradeRepository.createStudentsAndEnrollments(grade.id, students);
        }

        return grade;
    }
}

module.exports = CreateGrade;
