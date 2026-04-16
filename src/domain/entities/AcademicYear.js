class AcademicYear {
    constructor(id, name, startDate, endDate, active, deletedAt = null) {
        this.id = id;
        this.name = name;
        this.startDate = startDate;
        this.endDate = endDate;
        this.active = active;
        this.deletedAt = deletedAt;
    }
}
module.exports = AcademicYear;