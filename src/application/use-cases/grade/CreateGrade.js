class CreateGrade {
    constructor(gradeRepository) {
        this.gradeRepository = gradeRepository;
    }

    async execute(name, students = []) {
        if (!name || name.trim() === '') {
            throw new Error('El nombre del grado es obligatorio');
        }
        
        // Verificar si ya existe un grado con el mismo nombre
        const existing = await this.gradeRepository.findByNameIncludeDeleted(name);
        let grade;
        
        if (existing) {
            if (existing.deleted_at) {
                // Si está eliminado, reactivarlo
                grade = await this.gradeRepository.reactivate(existing.id);
                grade = await this.gradeRepository.findById(existing.id);
            } else {
                throw new Error(`Ya existe un grado con el nombre "${name}"`);
            }
        } else {
            grade = await this.gradeRepository.create(name);
        }
        
        // Crear estudiantes y matrículas si se enviaron
        if (students && students.length > 0) {
            await this.gradeRepository.createStudentsAndEnrollments(grade.id, students);
        }
        
        return grade;
    }
}

module.exports = CreateGrade;