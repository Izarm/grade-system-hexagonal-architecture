class DeletePeriod {
    constructor(periodRepository) {
        this.periodRepository = periodRepository;
    }

    async execute(id) {
        const existing = await this.periodRepository.findById(id);
        if (!existing) throw new Error('Período no encontrado');
        const deleted = await this.periodRepository.delete(id);
        if (!deleted) throw new Error('No se pudo eliminar');
        return true;
    }
}
module.exports = DeletePeriod;