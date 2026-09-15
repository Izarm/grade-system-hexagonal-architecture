const pool = require('../../infrastructure/database/mysql');
const GroupRepository = require('../../infrastructure/repositories/GroupRepository');

const repo = new GroupRepository();

exports.list = async (req, res) => {
    try {
        const { academicYearId } = req.query;
        const groups = await repo.findAll(academicYearId || null);
        const [gradesRows] = await pool.query('SELECT id, name FROM grades WHERE deleted_at IS NULL');
        const gradesMap = {};
        gradesRows.forEach(g => { gradesMap[g.id] = g.name; });
        
        const groupsWithGrade = groups.map(group => ({
            id:              group.id,
            grade_id:        group.grade_id,
            name:            group.name,
            head_teacher_id: group.head_teacher_id ?? null,
            academic_year_id: group.academic_year_id,
            grade_name:      group.grade_name || gradesMap[group.grade_id] || null,
            takes_grades:    group.takes_grades,
        }));
        
        res.json(groupsWithGrade);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.listByGrade = async (req, res) => {
    try {
        const { gradeId } = req.params;
        const groups = await repo.findByGrade(parseInt(gradeId));
        
        const [gradesRows] = await pool.query('SELECT id, name FROM grades WHERE deleted_at IS NULL');
        const gradesMap = {};
        gradesRows.forEach(g => { gradesMap[g.id] = g.name; });
        
        const groupsWithGrade = groups.map(group => ({
            id:              group.id,
            grade_id:        group.grade_id,
            name:            group.name,
            head_teacher_id: group.head_teacher_id ?? null,
            academic_year_id: group.academic_year_id,
            grade_name:      group.grade_name || gradesMap[group.grade_id] || null,
            takes_grades:    group.takes_grades,
        }));
        
        res.json(groupsWithGrade);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getById = async (req, res) => {
    try {
        const { id } = req.params;
        const group = await repo.findById(parseInt(id));
        if (!group) {
            return res.status(404).json({ message: 'Grupo no encontrado' });
        }
        res.json(group);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.create = async (req, res) => {
    try {
        const { gradeId, name } = req.body;
        
        if (!gradeId || !name) {
            return res.status(400).json({ message: 'gradeId y name son requeridos' });
        }
        
        const existing = await repo.findByGradeAndName(gradeId, name);
        if (existing) {
            return res.status(400).json({ message: 'Ya existe un grupo con ese nombre para este grado' });
        }
        
        const group = await repo.create({ gradeId, name });
        res.status(201).json(group);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { gradeId, name } = req.body;
        
        const updated = await repo.update(id, { gradeId, name });
        if (!updated) {
            return res.status(404).json({ message: 'Grupo no encontrado' });
        }
        
        res.json({ message: 'Grupo actualizado' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.delete = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await repo.delete(id);
        if (!deleted) {
            return res.status(404).json({ message: 'Grupo no encontrado' });
        }
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.assignHeadTeacher = async (req, res) => {
    try {
        const { id } = req.params;
        const { teacherId } = req.body;
        await repo.updateHeadTeacher(id, teacherId || null);
        res.json({ message: 'Director asignado correctamente' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};