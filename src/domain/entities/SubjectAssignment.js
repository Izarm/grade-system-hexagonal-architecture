class SubjectAssignment {
    constructor(id, groupId, subjectId, teacherId, academicYearId, weeklyHours = null, deletedAt = null) {
        this.id = id;
        this.groupId = groupId;
        this.subjectId = subjectId;
        this.teacherId = teacherId;
        this.academicYearId = academicYearId;
        this.weeklyHours = weeklyHours;
        this.deletedAt = deletedAt;
    }
}
module.exports = SubjectAssignment;