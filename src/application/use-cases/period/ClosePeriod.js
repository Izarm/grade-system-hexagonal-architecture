// src/application/use-cases/period/ClosePeriod.js
class ClosePeriod {
    constructor(periodRepository) {
        this.periodRepository = periodRepository;
    }

    async execute(periodId, userId) {
        if (!periodId) throw new Error('ID de período requerido');
        const closed = await this.periodRepository.closePeriod(periodId, userId);
        if (!closed) throw new Error('No se pudo cerrar el período');
        return { success: true, message: 'Período cerrado exitosamente' };
    }
}
module.exports = ClosePeriod;