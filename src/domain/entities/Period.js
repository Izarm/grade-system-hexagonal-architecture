class Period {
    constructor(id, academicYearId, name, order, startDate, endDate, status, closedBy, closedAt, deletedAt = null) {
        this.id = id;
        this.academicYearId = academicYearId;
        this.name = name;
        this.order = order;
        this.startDate = startDate;
        this.endDate = endDate;
        this.status = status;
        this.closedBy = closedBy;
        this.closedAt = closedAt;
        this.deletedAt = deletedAt;
    }
}
module.exports = Period;