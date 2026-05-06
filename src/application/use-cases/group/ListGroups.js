class ListGroups {
    constructor(groupRepository) {
        this.groupRepository = groupRepository;
    }
    async execute() {
        return await this.groupRepository.findAll();
    }
}
module.exports = ListGroups;