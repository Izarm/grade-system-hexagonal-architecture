class ListAcademicYears {
    constructor(academicYearRepository) {
        this.academicYearRepository = academicYearRepository;
    }
    async execute() {
        return await this.academicYearRepository.findAll();
    }
}
module.exports = ListAcademicYears;