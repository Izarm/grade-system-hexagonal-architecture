class Grade {
    constructor(id, name, deletedAt = null) {
        this.id = id;
        this.name = name;
        this.deletedAt = deletedAt;
    }
}
module.exports = Grade; 