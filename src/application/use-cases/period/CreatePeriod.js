class CreateGrade {
    constructor(gradeRepository) {
        this.gradeRepository = gradeRepository;
    }

    async execute(name) {
        if (!name) throw new Error('El nombre del grado es obligatorio');
        
        // Verificar si ya existe un grado con ese nombre (incluyendo eliminados)
        const existingGrade = await this.gradeRepository.findByNameIncludeDeleted(name);
        
        if (existingGrade) {
            // Si existe pero está eliminado, reactivarlo
            if (existingGrade.deleted_at) {
                await this.gradeRepository.reactivate(existingGrade.id);
                
                // Reactivar sus grupos A y B
                const GroupRepository = require('../../infrastructure/repositories/GroupRepository');
                const groupRepo = new GroupRepository();
                const groups = await groupRepo.findByGrade(existingGrade.id);
                
                for (const group of groups) {
                    await groupRepo.reactivate(group.id);
                }
                
                return existingGrade;
            } else {
                throw new Error('Ya existe un grado con ese nombre');
            }
        }
        
        // Crear el grado
        const grade = await this.gradeRepository.create(name);
        const gradeId = grade.id;
        
        // Crear grupos A y B
        const GroupRepository = require('../../infrastructure/repositories/GroupRepository');
        const groupRepo = new GroupRepository();
        
        await groupRepo.create({ gradeId, name: 'A' });
        await groupRepo.create({ gradeId, name: 'B' });
        
        return grade;
    }
}

module.exports = CreateGrade;