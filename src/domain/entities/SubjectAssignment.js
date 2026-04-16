class SubjectAssignment {
    constructor(id, groupId, subjectId, teacherId, academicYearId, deletedAt = null) {
        this.id = id;
        this.groupId = groupId;
        this.subjectId = subjectId;
        this.teacherId = teacherId;
        this.academicYearId = academicYearId;
        this.deletedAt = deletedAt;
    }
}
module.exports = SubjectAssignment;