const CreateAcademicYear = require('../../application/use-cases/academicYear/CreateAcademicYear');
const UpdateAcademicYear = require('../../application/use-cases/academicYear/UpdateAcademicYear');
const DeleteAcademicYear = require('../../application/use-cases/academicYear/DeleteAcademicYear');
const ListAcademicYears = require('../../application/use-cases/academicYear/ListAcademicYears');
const GetAcademicYear = require('../../application/use-cases/academicYear/GetAcademicYear');
const ListAcademicYearsPaginated = require('../../application/use-cases/academicYear/ListAcademicYearsPaginated');
const AcademicYearRepository = require('../../infrastructure/repositories/AcademicYearRepository');
const PeriodRepository = require('../../infrastructure/repositories/PeriodRepository');
const CloseAcademicYear = require('../../application/use-cases/academicYear/CloseAcademicYear');

const repo = new AcademicYearRepository();
const periodRepo = new PeriodRepository();
const create = new CreateAcademicYear(repo);
const update = new UpdateAcademicYear(repo);
const del = new DeleteAcademicYear(repo);
const list = new ListAcademicYears(repo);
const get = new GetAcademicYear(repo);
const listPaginated = new ListAcademicYearsPaginated(repo);

exports.create = async (req, res) => {
    try {
        const { name, startDate, endDate, active, periods } = req.body;

        const year = await create.execute({ name, startDate, endDate, active });

        if (periods && periods.length) {
            for (let p of periods) {
                await periodRepo.create({
                    academicYearId: year.id,
                    name: p.name,
                    order: p.order,
                    startDate: p.startDate,
                    endDate: p.endDate,
                    status: p.status || 'open',
                    percentage: p.percentage
                });
            }
        }

        res.status(201).json(year);
    } catch (error) {
        console.error('Error en create academicYear:', error);
        res.status(400).json({ message: error.message });
    }
};

exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, startDate, endDate, active, periods } = req.body;

        const updatedYear = await update.execute(id, { name, startDate, endDate, active });

        if (periods && periods.length) {
            const existingPeriods = await periodRepo.findByAcademicYear(parseInt(id));
            const existingIds = existingPeriods.map(p => p.id);
            const receivedIds = periods.filter(p => p && p.id).map(p => p.id);
            
            const toDelete = existingIds.filter(existingId => !receivedIds.includes(existingId));
            for (const periodId of toDelete) {
                await periodRepo.delete(periodId);
            }
            
            for (const p of periods) {
                if (p.id) {
                    await periodRepo.update(p.id, {
                        name: p.name,
                        order: p.order,
                        startDate: p.startDate,
                        endDate: p.endDate,
                        status: p.status || 'open',
                        percentage: p.percentage
                    });
                } else if (p.name && p.order) {
                    await periodRepo.create({
                        academicYearId: parseInt(id),
                        name: p.name,
                        order: p.order,
                        startDate: p.startDate,
                        endDate: p.endDate,
                        status: p.status || 'open',
                        percentage: p.percentage || 0
                    });
                }
            }
        }

        res.json(updatedYear);
    } catch (error) {
        console.error('Error en update academicYear:', error);
        res.status(400).json({ message: error.message });
    }
};

exports.delete = async (req, res) => {
    try {
        await periodRepo.deleteByAcademicYearId(req.params.id);
        await del.execute(req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error('Error en delete academicYear:', error);
        res.status(400).json({ message: error.message });
    }
};

exports.list = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const result = await listPaginated.execute(page, limit);
        res.json(result);
    } catch (error) {
        console.error('Error en list academicYears:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.listPaginated = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const result = await listPaginated.execute(page, limit);
        res.json(result);
    } catch (error) {
        console.error('Error en listPaginated academicYears:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.getById = async (req, res) => {
    try {
        const year = await get.execute(req.params.id);
        res.json(year);
    } catch (error) {
        console.error('Error en getById academicYear:', error);
        res.status(404).json({ message: error.message });
    }
};

exports.getActive = async (req, res) => {
    try {
        const activeYear = await repo.findActive();
        
        if (!activeYear) {
            return res.status(200).json(null);
        }
        
        // Como la tabla ya no tiene columna 'status', derivamos el valor de 'active'
        const response = {
            ...activeYear,
            status: activeYear.active === 1 ? 'open' : 'closed'
        };
        
        res.json(response);
    } catch (error) {
        console.error('Error en getActive:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.closeYear = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const closeYearUseCase = new CloseAcademicYear(repo);
        
        const result = await closeYearUseCase.execute(id, userId);
        res.json(result);
    } catch (error) {
        console.error('Error en closeYear:', error);
        res.status(400).json({ message: error.message });
    }
};

exports.reopenYear = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        const result = await repo.reopenYear(id, userId);
        res.json(result);
    } catch (error) {
        console.error('Error en reopenYear:', error);
        res.status(400).json({ message: error.message });
    }
};