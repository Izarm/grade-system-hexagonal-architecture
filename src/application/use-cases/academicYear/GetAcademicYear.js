class GetAcademicYear {
    constructor(academicYearRepository) {
        this.academicYearRepository = academicYearRepository;
    }
    async execute(id) {
        const year = await this.academicYearRepository.findById(id);
        if (!year) throw new Error('Año lectivo no encontrado');
        return year;
    }
}
module.exports = GetAcademicYear;