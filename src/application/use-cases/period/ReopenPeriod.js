class ReopenPeriod {
    constructor(periodRepository) {
        this.periodRepository = periodRepository;
    }

    async execute(periodId) {
        if (!periodId) throw new Error('ID de período requerido');
        const reopened = await this.periodRepository.reopenPeriod(periodId);
        if (!reopened) throw new Error('No se pudo reabrir el período');
        return { success: true, message: 'Período reabierto exitosamente' };
    }
}

module.exports = ReopenPeriod;