class GetPeriod {
    constructor(periodRepository) {
        this.periodRepository = periodRepository;
    }

    async execute(id) {
        const period = await this.periodRepository.findById(id);
        if (!period) throw new Error('Período no encontrado');
        return period;
    }
}
module.exports = GetPeriod;