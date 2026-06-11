class ListAcademicYearsPaginated {
    constructor(academicYearRepository) {
        this.academicYearRepository = academicYearRepository;
    }

    async execute(page, limit) {
        const offset = (page - 1) * limit;
        const data = await this.academicYearRepository.findAllPaginated(limit, offset);
        const total = await this.academicYearRepository.countAll();
        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };
    }
}

module.exports = ListAcademicYearsPaginated;