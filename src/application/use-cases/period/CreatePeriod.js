class CreatePeriod {
    constructor(periodRepository) {
        this.periodRepository = periodRepository;
    }

    async execute(data) {
        const { academicYearId, name, order, startDate, endDate, status } = data;
        if (!academicYearId || !name || !order || !startDate || !endDate) {
            throw new Error('Faltan campos obligatorios');
        }
        if (new Date(startDate) >= new Date(endDate)) {
            throw new Error('La fecha de inicio debe ser anterior a la fecha de fin');
        }
        // Validar que el orden sea único dentro del mismo año académico
        const existing = await this.periodRepository.findByAcademicYear(academicYearId);
        if (existing.some(p => p.order == order)) {
            throw new Error(`Ya existe un período con orden ${order} para este año lectivo`);
        }
        return await this.periodRepository.create(data);
    }
}
module.exports = CreatePeriod;