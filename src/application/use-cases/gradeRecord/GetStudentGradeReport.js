class GetStudentGradeReport {
    constructor(gradeRecordRepository) {
        this.gradeRecordRepository = gradeRecordRepository;
    }

    async execute(studentId, academicYearId) {
        if (!studentId || !academicYearId) throw new Error('Faltan parámetros');
        return await this.gradeRecordRepository.getStudentGradeReport(studentId, academicYearId);
    }
}
module.exports = GetStudentGradeReport;