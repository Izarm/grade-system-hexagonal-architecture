class GetGradesByAssignmentAndPeriod {
    constructor(gradeRecordRepository, periodRepository) {
        this.gradeRecordRepository = gradeRecordRepository;
        this.periodRepository = periodRepository;
    }

    async execute(subjectAssignmentId, periodId) {
        const isOpen = await this.periodRepository.checkOpen(periodId);
        const grades = await this.gradeRecordRepository.findByAssignmentAndPeriod(subjectAssignmentId, periodId);
        return { grades, periodOpen: isOpen };
    }
}
module.exports = GetGradesByAssignmentAndPeriod;