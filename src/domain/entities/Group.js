class Group {
    constructor(id, gradeId, name, deletedAt = null) {
        this.id = id;
        this.gradeId = gradeId;
        this.name = name;
        this.deletedAt = deletedAt;
    }
}
module.exports = Group;