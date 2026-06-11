import { useState, useEffect } from 'react';
import api from '../../api/client';
import ConfirmDialog from '../common/ConfirmDialog';
import { useRefresh } from '../../contexts/RefreshContext';

const Grades = () => {
    const { refreshKey, refresh } = useRefresh();
    const [grades, setGrades] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [form, setForm] = useState({ name: '', students: [] });
    const [newStudentName, setNewStudentName] = useState('');
    const [newStudentCode, setNewStudentCode] = useState('');
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [gradeToDelete, setGradeToDelete] = useState(null);
    const [showStudentsModal, setShowStudentsModal] = useState(false);
    const [selectedGrade, setSelectedGrade] = useState(null);
    const [selectedGradeId, setSelectedGradeId] = useState(null);
    const [studentsInGrade, setStudentsInGrade] = useState([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [assigningHeadTeacher, setAssigningHeadTeacher] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [activeTab, setActiveTab] = useState('create');
    const [searchTeacher, setSearchTeacher] = useState('');
    const [openSelect, setOpenSelect] = useState(null);
    const [showConfirmStudent, setShowConfirmStudent] = useState(false);
    const [enrollmentToDelete, setEnrollmentToDelete] = useState(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentGrades = grades.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(grades.length / itemsPerPage);

    const sortGrades = (gradesArray) => {
        return [...gradesArray].sort((a, b) => {
            const numA = parseInt(a.name.split('°')[0]);
            const numB = parseInt(b.name.split('°')[0]);
            if (numA !== numB) return numA - numB;
            const letterA = a.name.split('°')[1] || '';
            const letterB = b.name.split('°')[1] || '';
            const order = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8, 'I': 9, 'J': 10 };
            const orderA = order[letterA.toUpperCase()] || 99;
            const orderB = order[letterB.toUpperCase()] || 99;
            return orderA - orderB;
        });
    };

    const loadTeachers = async () => {
        try {
            const res = await api.get('/users');
            const usersData = Array.isArray(res.data) ? res.data : (res.data.data || []);
            const teachersList = usersData.filter(u => u.role === 'docente');
            setTeachers(teachersList);
        } catch (error) {
            console.error('Error cargando docentes:', error);
            setTeachers([]);
        }
    };

    const loadGradesWithCount = async (resetPage = true) => {
        setLoading(true);
        try {
            const gradesRes = await api.get('/grades');
            let gradesData = Array.isArray(gradesRes.data) ? gradesRes.data : (gradesRes.data.data || []);

            gradesData = sortGrades(gradesData);

            const groupsRes = await api.get('/groups');
            const groups = Array.isArray(groupsRes.data) ? groupsRes.data : (groupsRes.data.data || []);

            const groupToGrade = {};
            groups.forEach(group => {
                groupToGrade[group.id] = group.grade_id;
            });

            const enrollmentsRes = await api.get('/enrollments');
            const enrollments = Array.isArray(enrollmentsRes.data) ? enrollmentsRes.data : (enrollmentsRes.data.data || []);

            const countByGrade = {};
            enrollments.forEach(enrollment => {
                const gradeId = groupToGrade[enrollment.group_id];
                if (gradeId) {
                    countByGrade[gradeId] = (countByGrade[gradeId] || 0) + 1;
                }
            });

            const gradesWithCount = gradesData.map(grade => ({
                ...grade,
                studentCount: countByGrade[grade.id] || 0
            }));

            setGrades(gradesWithCount);
            if (resetPage) setCurrentPage(1);
        } catch (error) {
            console.error('Error cargando grados:', error);
            setGrades([]);
        } finally {
            setLoading(false);
        }
    };

    const loadStudentsByGrade = async (gradeId, gradeName) => {
        setLoadingStudents(true);
        setSelectedGrade(gradeName);
        setSelectedGradeId(gradeId);

        try {
            const groupsRes = await api.get(`/groups/by-grade/${gradeId}`);
            let groups = Array.isArray(groupsRes.data) ? groupsRes.data : (groupsRes.data.data || []);

            if (groups.length === 0) {
                setStudentsInGrade([]);
                setShowStudentsModal(true);
                setLoadingStudents(false);
                return;
            }

            const groupIds = groups.map(g => g.id);

            const enrollmentsRes = await api.get('/enrollments');
            let enrollments = Array.isArray(enrollmentsRes.data) ? enrollmentsRes.data : (enrollmentsRes.data.data || []);

            const gradeEnrollments = enrollments.filter(e => groupIds.includes(e.group_id));

            const students = [];
            for (const e of gradeEnrollments) {
                try {
                    const studentRes = await api.get(`/students/${e.student_id}`);
                    const studentData = studentRes.data;
                    students.push({
                        enrollmentId: e.id,
                        id: e.student_id,
                        full_name: studentData.full_name,
                        student_code: studentData.student_code,
                        folio_number: e.folio_number
                    });
                } catch (err) {
                    console.error('Error cargando estudiante:', e.student_id, err);
                }
            }

            students.sort((a, b) => {
                if (a.folio_number && b.folio_number) {
                    return a.folio_number - b.folio_number;
                }
                return a.full_name.localeCompare(b.full_name);
            });

            setStudentsInGrade(students);
            setShowStudentsModal(true);
        } catch (error) {
            console.error('Error cargando estudiantes:', error);
            setMessage({ type: 'error', text: 'Error al cargar los estudiantes' });
            setTimeout(() => setMessage(null), 3000);
        } finally {
            setLoadingStudents(false);
        }
    };

    const addStudentToList = () => {
        if (!newStudentName || !newStudentCode) {
            setMessage({ type: 'error', text: 'Nombre y codigo son obligatorios' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }

        setForm(prev => ({
            ...prev,
            students: [...prev.students, { fullName: newStudentName, studentCode: newStudentCode }]
        }));
        setNewStudentName('');
        setNewStudentCode('');
    };

    const removeStudentFromList = (index) => {
        setForm(prev => ({
            ...prev,
            students: prev.students.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.name) {
            setMessage({ type: 'error', text: 'Nombre del grado obligatorio' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            await api.post('/grades', {
                name: form.name,
                students: form.students
            });

            setMessage({ type: 'success', text: `Grado "${form.name}" creado` });
            setForm({ name: '', students: [] });
            loadGradesWithCount();
        } catch (err) {
            console.error('Error al crear grado:', err);
            setMessage({ type: 'error', text: err.response?.data?.message || 'Error al crear grado' });
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const addStudentToGrade = async () => {
        if (!newStudentName || !newStudentCode) {
            setMessage({ type: 'error', text: 'Nombre y codigo son obligatorios' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }

        setLoading(true);
        try {
            // Buscar si el estudiante ya existe por código
            let studentId;
            const searchRes = await api.get(`/students?code=${encodeURIComponent(newStudentCode)}`);
            const existing = (Array.isArray(searchRes.data) ? searchRes.data : (searchRes.data.data || []))
                .find(s => s.student_code === newStudentCode);

            if (existing) {
                studentId = existing.id;
            } else {
                const studentRes = await api.post('/students', {
                    fullName: newStudentName,
                    studentCode: newStudentCode
                });
                studentId = studentRes.data.id;
            }

            const yearsRes = await api.get('/academic-years');
            const yearsData = yearsRes.data.data || yearsRes.data;
            const activeYear = yearsData.find(y => y.active === 1);

            if (!activeYear) {
                throw new Error('No hay año lectivo activo');
            }

            const groupsRes = await api.get(`/groups/by-grade/${selectedGradeId}`);
            let groups = Array.isArray(groupsRes.data) ? groupsRes.data : (groupsRes.data.data || []);

            if (groups.length === 0) {
                setMessage({ type: 'error', text: 'No hay grupos configurados para este grado' });
                setLoading(false);
                return;
            }

            const groupId = groups[0].id;

            await api.post('/enrollments', {
                studentId,
                groupId,
                academicYearId: activeYear.id
            });

            setMessage({ type: 'success', text: 'Estudiante agregado y matriculado' });
            setNewStudentName('');
            setNewStudentCode('');
            await loadStudentsByGrade(selectedGradeId, selectedGrade);
            loadGradesWithCount(false);
        } catch (error) {
            console.error('Error agregando estudiante:', error);
            setMessage({ type: 'error', text: error.response?.data?.message || 'Error al agregar' });
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const updateStudent = async () => {
        if (!editingStudent) return;

        setLoading(true);
        try {
            await api.put(`/students/${editingStudent.id}`, {
                fullName: editingStudent.full_name,
                studentCode: editingStudent.student_code
            });
            setMessage({ type: 'success', text: 'Estudiante actualizado' });
            setEditingStudent(null);
            await loadStudentsByGrade(selectedGradeId, selectedGrade);
            loadGradesWithCount(false);
        } catch (error) {
            console.error('Error actualizando estudiante:', error);
            setMessage({ type: 'error', text: 'Error al actualizar' });
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const deleteStudentFromGrade = (enrollmentId) => {
        setEnrollmentToDelete(enrollmentId);
        setShowConfirmStudent(true);
    };

    const confirmDeleteStudent = async () => {
        if (enrollmentToDelete) {
            setLoading(true);
            try {
                await api.delete(`/enrollments/${enrollmentToDelete}`);
                setMessage({ type: 'success', text: 'Estudiante eliminado' });
                await loadStudentsByGrade(selectedGradeId, selectedGrade);
                loadGradesWithCount(false);
            } catch (error) {
                console.error('Error eliminando estudiante:', error);
                setMessage({ type: 'error', text: 'Error al eliminar' });
            } finally {
                setLoading(false);
                setTimeout(() => setMessage(null), 3000);
            }
        }
        setShowConfirmStudent(false);
        setEnrollmentToDelete(null);
    };

    const cancelDeleteStudent = () => {
        setShowConfirmStudent(false);
        setEnrollmentToDelete(null);
    };

    const assignHeadTeacher = async (gradeId, teacherId) => {
        setAssigningHeadTeacher(true);
        try {
            await api.put(`/grades/${gradeId}/head-teacher`, { teacherId: teacherId || null });
            setMessage({ type: 'success', text: 'Director asignado' });
            loadGradesWithCount(false);
            setOpenSelect(null);
        } catch (error) {
            console.error('Error asignando director:', error);
            setMessage({ type: 'error', text: 'Error al asignar' });
        } finally {
            setAssigningHeadTeacher(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    useEffect(() => {
        loadGradesWithCount(false);
        loadTeachers();
    }, [refreshKey]);

    const handleDeleteClick = (id) => {
        setGradeToDelete(id);
        setShowConfirm(true);
    };

    const confirmDelete = async () => {
        if (gradeToDelete) {
            setLoading(true);
            try {
                await api.delete(`/grades/${gradeToDelete}`);
                setMessage({ type: 'success', text: 'Grado eliminado' });
                loadGradesWithCount(false);
                if (currentGrades.length === 1 && currentPage > 1) {
                    setCurrentPage(currentPage - 1);
                }
            } catch (err) {
                console.error('Error al eliminar:', err);
                setMessage({ type: 'error', text: err.response?.data?.message || 'Error al eliminar' });
            } finally {
                setLoading(false);
                setTimeout(() => setMessage(null), 3000);
            }
        }
        setShowConfirm(false);
        setGradeToDelete(null);
    };

    const cancelDelete = () => setShowConfirm(false);

    const goToPage = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const filteredTeachers = teachers.filter(t =>
        t.name.toLowerCase().includes(searchTeacher.toLowerCase())
    );

    const getTeacherName = (teacherId) => {
        const teacher = teachers.find(t => t.id === teacherId);
        return teacher ? teacher.name : 'Sin director';
    };

    return (
        <div className="max-w-6xl mx-auto px-6 py-6">
            {message && (
                <div className={`fixed top-5 right-5 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm ${
                    message.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                }`}>
                    {message.text}
                </div>
            )}

            <div className="flex mb-6 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('create')}
                    className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                        activeTab === 'create'
                            ? 'border-blue-700 text-blue-700'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    Crear grado
                </button>
                <button
                    onClick={() => setActiveTab('list')}
                    className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                        activeTab === 'list'
                            ? 'border-blue-700 text-blue-700'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    Listado de grados
                </button>
            </div>

            {activeTab === 'create' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 card-hover">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h2 className="text-[15px] font-semibold text-gray-800">Crear grado</h2>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Nombre del grado</label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="Ej: 1°A"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium text-gray-600">Estudiantes</label>
                                <span className="text-xs text-gray-400">{form.students.length} agregados</span>
                            </div>

                            {form.students.length > 0 && (
                                <div className="mb-3 bg-gray-50 rounded-lg p-2 max-h-40 overflow-y-auto">
                                    {form.students.map((student, idx) => (
                                        <div key={idx} className="flex items-center justify-between text-sm py-1.5 px-2">
                                            <div className="flex gap-3">
                                                <span className="text-gray-700">{student.fullName}</span>
                                                <span className="text-gray-400 text-xs">{student.studentCode}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeStudentFromList(idx)}
                                                className="text-rose-400 hover:text-rose-600 text-xs"
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Nombre"
                                    value={newStudentName}
                                    onChange={(e) => setNewStudentName(e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                />
                                <input
                                    type="text"
                                    placeholder="Codigo"
                                    value={newStudentCode}
                                    onChange={(e) => setNewStudentCode(e.target.value)}
                                    className="w-32 px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={addStudentToList}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition"
                                >
                                    Agregar
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-700 hover:bg-blue-800 text-white font-medium btn-press py-2 rounded-lg transition disabled:opacity-50 text-sm"
                        >
                            {loading ? 'Creando...' : `Crear grado${form.students.length ? ` (${form.students.length} estudiantes)` : ''}`}
                        </button>
                    </form>
                </div>
            )}

            {activeTab === 'list' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 card-hover overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                        <h2 className="text-[15px] font-semibold text-gray-800">Listado de grados</h2>
                        <button
                            onClick={loadGradesWithCount}
                            className="text-gray-500 hover:text-gray-700 text-sm transition flex items-center gap-1"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                            </svg>
                            Actualizar
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Grado</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Director</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Estudiantes</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {currentGrades.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="px-5 py-8 text-center text-gray-400 text-sm">
                                            No hay grados registrados
                                        </td>
                                    </tr>
                                ) : (
                                    currentGrades.map((grade) => (
                                        <tr key={grade.id} className="hover:bg-gray-50/50">
                                            <td className="px-5 py-3 font-medium text-gray-800">{grade.name}</td>
                                            <td className="px-5 py-3 relative">
                                                <div className="relative">
                                                    <button
                                                        onClick={() => setOpenSelect(openSelect === grade.id ? null : grade.id)}
                                                        className="w-48 text-left px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white flex items-center justify-between"
                                                    >
                                                        <span className={grade.head_teacher_id ? 'text-gray-700' : 'text-gray-400'}>
                                                            {getTeacherName(grade.head_teacher_id)}
                                                        </span>
                                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                                        </svg>
                                                    </button>

                                                    {openSelect === grade.id && (
                                                        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                                                            <div className="p-2 border-b border-gray-100">
                                                                <input
                                                                    type="text"
                                                                    placeholder="Buscar docente..."
                                                                    value={searchTeacher}
                                                                    onChange={(e) => setSearchTeacher(e.target.value)}
                                                                    className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 outline-none"
                                                                />
                                                            </div>
                                                            <div className="max-h-48 overflow-y-auto">
                                                                <div
                                                                    onClick={() => assignHeadTeacher(grade.id, null)}
                                                                    className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 transition"
                                                                >
                                                                    Sin director
                                                                </div>
                                                                {filteredTeachers.map((teacher) => (
                                                                    <div
                                                                        key={teacher.id}
                                                                        onClick={() => assignHeadTeacher(grade.id, teacher.id)}
                                                                        className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 transition"
                                                                    >
                                                                        {teacher.name}
                                                                    </div>
                                                                ))}
                                                                {filteredTeachers.length === 0 && (
                                                                    <div className="px-3 py-2 text-sm text-gray-400 text-center">
                                                                        No hay docentes
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <button
                                                    onClick={() => loadStudentsByGrade(grade.id, grade.name)}
                                                    className="text-blue-700 hover:text-blue-700 text-sm font-medium"
                                                >
                                                    Editar ({grade.studentCount || 0})
                                                </button>
                                            </td>
                                            <td className="px-5 py-3">
                                                <button
                                                    onClick={() => handleDeleteClick(grade.id)}
                                                    className="text-red-400 hover:text-red-500 text-sm transition"
                                                >
                                                    Eliminar
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-2 py-4 border-t border-gray-100 bg-gray-50/50">
                            <button
                                onClick={() => goToPage(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                                Anterior
                            </button>
                            <div className="flex gap-1">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                    <button
                                        key={page}
                                        onClick={() => goToPage(page)}
                                        className={`w-7 h-7 text-xs rounded-md transition ${
                                            currentPage === page
                                                ? 'bg-blue-700 text-white'
                                                : 'text-gray-600 hover:bg-gray-100'
                                        }`}
                                    >
                                        {page}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => goToPage(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                                Siguiente
                            </button>
                        </div>
                    )}
                </div>
            )}

            {showStudentsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden">
                        <div className="flex justify-between items-center px-5 py-3 border-b border-gray-100 bg-gray-50">
                            <h3 className="text-[15px] font-semibold text-gray-800">{selectedGrade}</h3>
                            <button
                                onClick={() => setShowStudentsModal(false)}
                                className="text-gray-400 hover:text-gray-600 text-xl"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto max-h-[calc(85vh-120px)] bg-gray-50">
                            {loadingStudents ? (
                                <div className="flex justify-center py-8">
                                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : (
                                <>
                                    <div className="bg-white rounded-lg border border-gray-100 overflow-hidden mb-5">
                                        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/50">
                                            <span className="text-xs font-medium text-gray-500">Estudiantes ({studentsInGrade.length})</span>
                                        </div>

                                        {studentsInGrade.length === 0 ? (
                                            <div className="p-6 text-center text-gray-400 text-sm">
                                                No hay estudiantes
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-gray-50 border-b border-gray-100">
                                                        <tr>
                                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Folio</th>
                                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Nombre</th>
                                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Codigo</th>
                                                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Acciones</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-50">
                                                        {studentsInGrade.map((student) => (
                                                            <tr key={student.id} className="hover:bg-gray-50/50">
                                                                <td className="px-4 py-2 text-center font-bold text-gray-700">
                                                                    {student.folio_number || '-'}
                                                                </td>
                                                                <td className="px-4 py-2">
                                                                    {editingStudent?.id === student.id ? (
                                                                        <input
                                                                            type="text"
                                                                            value={editingStudent.full_name}
                                                                            onChange={(e) => setEditingStudent({ ...editingStudent, full_name: e.target.value })}
                                                                            className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                                                                        />
                                                                    ) : (
                                                                        <span className="text-gray-700">{student.full_name}</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-2">
                                                                    {editingStudent?.id === student.id ? (
                                                                        <input
                                                                            type="text"
                                                                            value={editingStudent.student_code}
                                                                            onChange={(e) => setEditingStudent({ ...editingStudent, student_code: e.target.value })}
                                                                            className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                                                                        />
                                                                    ) : (
                                                                        <span className="text-gray-500">{student.student_code}</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-2 text-center">
                                                                    {editingStudent?.id === student.id ? (
                                                                        <div className="flex justify-center gap-2">
                                                                            <button
                                                                                onClick={updateStudent}
                                                                                className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 rounded text-xs font-medium"
                                                                            >
                                                                                Guardar
                                                                            </button>
                                                                            <button
                                                                                onClick={() => setEditingStudent(null)}
                                                                                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-3 py-1 rounded text-xs font-medium"
                                                                            >
                                                                                Cancelar
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex justify-center gap-3">
                                                                            <button
                                                                                onClick={() => setEditingStudent(student)}
                                                                                className="text-blue-700 hover:text-blue-700 text-xs font-medium"
                                                                            >
                                                                                Editar
                                                                            </button>
                                                                            <button
                                                                                onClick={() => deleteStudentFromGrade(student.enrollmentId)}
                                                                                className="text-red-400 hover:text-red-500 text-xs font-medium"
                                                                            >
                                                                                Eliminar
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-white rounded-lg border border-gray-100 p-4">
                                        <label className="text-sm font-medium text-gray-600 mb-2 block">Agregar estudiante</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Nombre"
                                                value={newStudentName}
                                                onChange={(e) => setNewStudentName(e.target.value)}
                                                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Codigo"
                                                value={newStudentCode}
                                                onChange={(e) => setNewStudentCode(e.target.value)}
                                                className="w-32 px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                            />
                                            <button
                                                onClick={addStudentToGrade}
                                                disabled={loading}
                                                className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
                                            >
                                                Agregar
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <button
                                onClick={() => setShowStudentsModal(false)}
                                className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 px-4 py-1.5 rounded-lg text-sm transition"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={showConfirm}
                onClose={cancelDelete}
                onConfirm={confirmDelete}
                title="Eliminar grado"
                message="Esta seguro de que desea eliminar este grado?"
                confirmText="Eliminar"
                cancelText="Cancelar"
            />

            <ConfirmDialog
                isOpen={showConfirmStudent}
                onClose={cancelDeleteStudent}
                onConfirm={confirmDeleteStudent}
                title="Eliminar estudiante"
                message="¿Estás seguro de que deseas eliminar este estudiante? Esta acción no se puede deshacer."
                confirmText="Eliminar"
                cancelText="Cancelar"
            />
        </div>
    );
};

export default Grades;

