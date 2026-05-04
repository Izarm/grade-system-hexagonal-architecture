class DeleteAcademicYear {
    constructor(academicYearRepository) {
        this.academicYearRepository = academicYearRepository;
    }
    async execute(id) {
        const existing = await this.academicYearRepository.findById(id);
        if (!existing) throw new Error('Año lectivo no encontrado');
        const deleted = await this.academicYearRepository.delete(id);
        if (!deleted) throw new Error('No se pudo eliminar');
        return true;
    }
}
module.exports = DeleteAcademicYear;