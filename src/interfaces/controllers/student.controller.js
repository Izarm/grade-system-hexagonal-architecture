const CreateStudent = require('../../application/use-cases/student/CreateStudent');
const UpdateStudent = require('../../application/use-cases/student/UpdateStudent');
const DeleteStudent = require('../../application/use-cases/student/DeleteStudent');
const ListStudents = require('../../application/use-cases/student/ListStudents');
const GetStudent = require('../../application/use-cases/student/GetStudent');
const StudentRepository = require('../../infrastructure/repositories/StudentRepository');
const pool = require('../../infrastructure/database/mysql');

const repo = new StudentRepository();
const create = new CreateStudent(repo);
const update = new UpdateStudent(repo);
const del = new DeleteStudent(repo);
const list = new ListStudents(repo);
const get = new GetStudent(repo);

exports.create = async (req, res) => {
    try {
        const result = await create.execute(req.body);
        res.status(201).json(result);
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('duplicate')) {
            return res.status(400).json({ message: 'Ya existe un estudiante con este código.' });
        }
        res.status(400).json({ message: error.message });
    }
};

exports.update = async (req, res) => {
    try {
        const result = await update.execute(req.params.id, req.body);
        res.json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.delete = async (req, res) => {
    try {
        await del.execute(req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.list = async (req, res) => {
    try {
        const students = await list.execute();
        res.json(students);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getById = async (req, res) => {
    try {
        const student = await get.execute(req.params.id);
        res.json(student);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
};

exports.updateFolio = async (req, res) => {
    try {
        const { id } = req.params;
        const { groupId, academicYearId } = req.body;
        
        const [result] = await pool.query(
            `SELECT COUNT(*) as count FROM enrollments 
             WHERE group_id = ? AND academic_year_id = ? AND deleted_at IS NULL`,
            [groupId, academicYearId]
        );
        
        const folioNumber = `${groupId}-${result[0].count + 1}`;
        
        await pool.query(
            `UPDATE students SET folio_number = ? WHERE id = ?`,
            [folioNumber, id]
        );
        
        res.json({ folio_number: folioNumber });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};