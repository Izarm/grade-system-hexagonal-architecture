class CreateAcademicYear {
    constructor(academicYearRepository) {
        this.academicYearRepository = academicYearRepository;
    }

    async execute(data) {
        const { name, startDate, endDate, active } = data;
        if (!name || !startDate || !endDate) {
            throw new Error('Faltan campos obligatorios');
        }
        if (new Date(startDate) >= new Date(endDate)) {
            throw new Error('La fecha de inicio debe ser anterior a la fecha de fin');
        }
        // Si se intenta crear un año activo, desactivar los demás
        if (active) {
            await this.academicYearRepository.deactivateAll();
        }
        return await this.academicYearRepository.create({ name, startDate, endDate, active });
    }
}
module.exports = CreateAcademicYear;