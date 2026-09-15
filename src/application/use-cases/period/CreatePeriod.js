class CreatePeriod {
    constructor(periodRepository) {
        this.periodRepository = periodRepository;
    }

    async execute(data) {
        const { academicYearId, name, order, startDate, endDate, percentage, status } = data;
        if (!academicYearId || !name || !order) {
            throw new Error('El año lectivo, nombre y orden del periodo son obligatorios');
        }
        return await this.periodRepository.create({
            academicYearId,
            name,
            order,
            startDate: startDate || null,
            endDate: endDate || null,
            percentage: percentage || 0,
            status: status || 'open'
        });
    }
}

module.exports = CreatePeriod;
