class Subject {
    constructor(id, name, area, intensityHours, deletedAt = null) {
        this.id = id;
        this.name = name;
        this.area = area;
        this.intensityHours = intensityHours;
        this.deletedAt = deletedAt;
    }
}
module.exports = Subject;