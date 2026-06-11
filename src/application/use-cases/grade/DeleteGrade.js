class DeleteGrade {
    constructor(gradeRepository) {
        this.gradeRepository = gradeRepository;
    }
    
    async execute(id) {
        const existing = await this.gradeRepository.findById(id);
        if (!existing) throw new Error('Grado no encontrado');
        
        // Eliminar las matrículas de los estudiantes en este grado
        await this.gradeRepository.deleteEnrollmentsByGrade(id);
        
        // Eliminar (soft delete) el grado
        const deleted = await this.gradeRepository.delete(id);
        if (!deleted) throw new Error('No se pudo eliminar');
        
        return true;
    }
}

module.exports = DeleteGrade;