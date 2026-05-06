class UpdatePeriod {
    constructor(periodRepository) {
        this.periodRepository = periodRepository;
    }

    async execute(id, data) {
        const existing = await this.periodRepository.findById(id);
        if (!existing) throw new Error('Período no encontrado');
        const { name, order, startDate, endDate, status } = data;
        if (new Date(startDate) >= new Date(endDate)) {
            throw new Error('La fecha de inicio debe ser anterior a la fecha de fin');
        }
        // Validar unicidad de orden (excluyendo el mismo período)
        const periods = await this.periodRepository.findByAcademicYear(existing.academicYearId);
        if (periods.some(p => p.order == order && p.id != id)) {
            throw new Error(`Ya existe otro período con orden ${order} en este año lectivo`);
        }
        const updated = await this.periodRepository.update(id, data);
        if (!updated) throw new Error('No se pudo actualizar');
        return { id, ...data };
    }
}
module.exports = UpdatePeriod;