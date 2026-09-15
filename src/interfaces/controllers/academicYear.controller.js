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

// Copia la estructura académica (grados y sus grupos/secciones) de un año a
// otro. Necesario porque los grados pertenecen a un año lectivo concreto.
exports.cloneStructure = async (req, res) => {
    const pool = require('../../infrastructure/database/mysql');
    const connection = await pool.getConnection();
    try {
        const toYearId = parseInt(req.params.id);
        const { fromYearId } = req.body;
        if (!fromYearId) return res.status(400).json({ message: 'Falta fromYearId' });
        if (parseInt(fromYearId) === toYearId) {
            return res.status(400).json({ message: 'El año origen y destino deben ser distintos' });
        }

        await connection.beginTransaction();

        const [[existing]] = await connection.query(
            'SELECT COUNT(*) AS n FROM grades WHERE academic_year_id = ? AND deleted_at IS NULL',
            [toYearId]
        );
        if (existing.n > 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'El año destino ya tiene grados creados' });
        }

        const [grades] = await connection.query(
            `SELECT id, name, full_name, is_elective, takes_grades, head_teacher_id
             FROM grades WHERE academic_year_id = ? AND deleted_at IS NULL`,
            [fromYearId]
        );
        if (grades.length === 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'El año origen no tiene grados' });
        }

        let gradesCreated = 0, groupsCreated = 0;
        for (const g of grades) {
            const [r] = await connection.query(
                `INSERT INTO grades (name, full_name, is_elective, takes_grades, head_teacher_id, academic_year_id)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [g.name, g.full_name, g.is_elective, g.takes_grades, g.head_teacher_id, toYearId]
            );
            gradesCreated++;

            const [groups] = await connection.query(
                'SELECT name, head_teacher_id FROM `groups` WHERE grade_id = ? AND deleted_at IS NULL',
                [g.id]
            );
            for (const grp of groups) {
                await connection.query(
                    'INSERT INTO `groups` (grade_id, name, head_teacher_id) VALUES (?, ?, ?)',
                    [r.insertId, grp.name, grp.head_teacher_id]
                );
                groupsCreated++;
            }
        }

        await connection.commit();
        res.json({ message: `Estructura copiada: ${gradesCreated} grado(s) y ${groupsCreated} grupo(s)`, gradesCreated, groupsCreated });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

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

        res.status(400).json({ message: error.message });
    }
};

exports.delete = async (req, res) => {
    try {
        await periodRepo.deleteByAcademicYearId(req.params.id);
        await del.execute(req.params.id);
        res.status(204).send();
    } catch (error) {

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

        res.status(500).json({ message: error.message });
    }
};

exports.getById = async (req, res) => {
    try {
        const year = await get.execute(req.params.id);
        res.json(year);
    } catch (error) {

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

        res.status(400).json({ message: error.message });
    }
};