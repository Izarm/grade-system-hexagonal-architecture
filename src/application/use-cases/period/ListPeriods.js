class ListPeriods {
    constructor(periodRepository) {
        this.periodRepository = periodRepository;
    }

    async execute() {
        return await this.periodRepository.findAll();
    }
}
module.exports = ListPeriods;