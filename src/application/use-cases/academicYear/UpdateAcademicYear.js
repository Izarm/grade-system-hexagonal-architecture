class UpdateAcademicYear {
    constructor(academicYearRepository) {
        this.academicYearRepository = academicYearRepository;
    }

    async execute(id, data) {
        const existing = await this.academicYearRepository.findById(id);
        if (!existing) throw new Error('Año lectivo no encontrado');
        const { name, startDate, endDate, active } = data;
        if (new Date(startDate) >= new Date(endDate)) {
            throw new Error('La fecha de inicio debe ser anterior a la fecha de fin');
        }
        if (active) {
            await this.academicYearRepository.deactivateAll();
        }
        const updated = await this.academicYearRepository.update(id, { name, startDate, endDate, active });
        if (!updated) throw new Error('No se pudo actualizar');
        return { id, ...data };
    }
}
module.exports = UpdateAcademicYear;   