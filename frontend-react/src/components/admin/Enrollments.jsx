import { useState, useEffect } from 'react';
import api from '../../api/client';
import ConfirmDialog from '../common/ConfirmDialog';
import { useActiveAcademicYear } from '../../hooks/useActiveAcademicYear';
import { useRefresh } from '../../contexts/RefreshContext';

const Enrollments = () => {
    const { refreshKey, refresh } = useRefresh();
    const [enrollments, setEnrollments] = useState([]);
    const [students, setStudents] = useState([]);
    const [groups, setGroups] = useState([]);
    const [form, setForm] = useState({ studentId: '', groupId: '' });
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [enrollmentToDelete, setEnrollmentToDelete] = useState(null);
    const [activeTab, setActiveTab] = useState('create');

    const [studentSearch, setStudentSearch] = useState('');
    const [showStudentDropdown, setShowStudentDropdown] = useState(false);
    const [listSearch, setListSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);

    const normalize = (str) => str?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') || '';
    const filteredEnrollments = enrollments.filter(e => normalize(e.student_name || e.full_name).includes(normalize(listSearch)));
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentEnrollments = filteredEnrollments.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredEnrollments.length / itemsPerPage);
    const filteredStudents = students.filter(s => normalize(s.full_name).includes(normalize(studentSearch)));

    const { activeYear, loading: yearLoading } = useActiveAcademicYear();

    const extractData = (response) => {
        if (!response) return [];
        if (response.data && Array.isArray(response.data)) return response.data;
        if (Array.isArray(response)) return response;
        if (response.data && response.data.data && Array.isArray(response.data.data)) return response.data.data;
        return [];
    };

    const getGradeNumber = (gradeName) => {
        const match = gradeName?.match(/(\d+)/);
        return match ? parseInt(match[0]) : 999;
    };

    const getGradeLetter = (gradeName) => {
        const match = gradeName?.match(/[A-Z]+$/);
        return match ? match[0] : '';
    };

    const loadEnrollments = async (resetPage = true) => {
        try {
            const res = await api.get('/enrollments');
            let data = extractData(res.data);

            data.sort((a, b) => {
                const numA = getGradeNumber(a.group_name);
                const numB = getGradeNumber(b.group_name);
                if (numA !== numB) return numA - numB;

                const letterA = getGradeLetter(a.group_name);
                const letterB = getGradeLetter(b.group_name);
                if (letterA !== letterB) return letterA.localeCompare(letterB);

                return (a.folio_number || 0) - (b.folio_number || 0);
            });

            setEnrollments(data);
            if (resetPage) setCurrentPage(1);
        } catch (error) {
            console.error('Error cargando matrículas:', error);
            setEnrollments([]);
        }
    };

    const loadStudentsList = async () => {
        try {
            const res = await api.get('/students');
            const data = extractData(res.data);
            setStudents(data);
        } catch (error) {
            console.error('Error cargando estudiantes:', error);
            setStudents([]);
        }
    };

    const loadGroupsList = async () => {
        try {
            const groupsRes = await api.get('/groups');
            const groupsData = extractData(groupsRes.data);

            const gradesRes = await api.get('/grades');
            const gradesData = extractData(gradesRes.data);
            const gradeMap = {};
            gradesData.forEach(g => { gradeMap[g.id] = g.name; });

            const groupsWithFullName = groupsData.map(g => ({
                id: g.id,
                grade_id: g.grade_id,
                name: g.name,
                full_name: g.name
            }));

            groupsWithFullName.sort((a, b) => {
                const numA = parseInt(a.full_name) || 0;
                const numB = parseInt(b.full_name) || 0;
                if (numA !== numB) return numA - numB;
                return a.full_name.localeCompare(b.full_name);
            });

            setGroups(groupsWithFullName);
        } catch (error) {
            console.error('Error cargando grupos:', error);
            setGroups([]);
        }
    };

    useEffect(() => {
        loadEnrollments();
        loadStudentsList();
        loadGroupsList();
    }, [refreshKey]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.studentId || !form.groupId) {
            setMessage({ type: 'error', text: 'Todos los campos son obligatorios' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }

        if (!activeYear) {
            setMessage({ type: 'error', text: 'No hay año lectivo activo' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }

        setLoading(true);
        setMessage(null);
        try {
            const payload = {
                studentId: parseInt(form.studentId),
                groupId: parseInt(form.groupId),
                academicYearId: activeYear.id
            };
            await api.post('/enrollments', payload);
            setMessage({ type: 'success', text: 'Matrícula creada exitosamente' });
            setForm({ studentId: '', groupId: '' });
            setStudentSearch('');
            refresh();
        } catch (err) {
            console.error('Error:', err);
            setMessage({ type: 'error', text: err.response?.data?.message || 'Error al crear matrícula' });
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleDeleteClick = (id) => {
        setEnrollmentToDelete(id);
        setShowConfirm(true);
    };

    const confirmDelete = async () => {
        if (enrollmentToDelete) {
            try {
                await api.delete(`/enrollments/${enrollmentToDelete}`);
                loadEnrollments(false);
                setMessage({ type: 'success', text: 'Matrícula eliminada' });
            } catch (err) {
                setMessage({ type: 'error', text: err.response?.data?.message || 'Error al eliminar' });
            }
            setTimeout(() => setMessage(null), 3000);
        }
        setShowConfirm(false);
        setEnrollmentToDelete(null);
    };

    const cancelDelete = () => setShowConfirm(false);

    const goToPage = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    if (yearLoading) {
        return <div className="flex justify-center py-8">Cargando año activo...</div>;
    }

    if (!activeYear) {
        return (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <p className="text-blue-700">Para usar este módulo primero crea un año lectivo en <strong>Años lectivos</strong>.</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-6 py-6">
            {message && (
                <div className={`fixed top-5 right-5 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm ${
                    message.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                }`}>
                    {message.text}
                </div>
            )}

            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                    Año lectivo activo: <strong>{activeYear.name}</strong>
                </p>
            </div>

            <div className="flex mb-6 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('create')}
                    className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                        activeTab === 'create'
                            ? 'border-blue-700 text-blue-700'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    Crear matrícula
                </button>
                <button
                    onClick={() => setActiveTab('list')}
                    className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                        activeTab === 'list'
                            ? 'border-blue-700 text-blue-700'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    Listado de matrículas
                </button>
            </div>

            {activeTab === 'create' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 card-hover">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h2 className="text-[15px] font-semibold text-gray-800">Matricular estudiante</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Selecciona el estudiante y el curso</p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="relative">
                                <label className="block text-sm font-medium text-gray-600 mb-1">Estudiante</label>
                                <input
                                    type="text"
                                    value={studentSearch}
                                    onChange={e => {
                                        setStudentSearch(e.target.value);
                                        setForm({ ...form, studentId: '' });
                                        setShowStudentDropdown(true);
                                    }}
                                    onFocus={() => setShowStudentDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowStudentDropdown(false), 150)}
                                    placeholder="Buscar estudiante por nombre..."
                                    autoComplete="off"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                />
                                {showStudentDropdown && filteredStudents.length > 0 && (
                                    <ul className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto text-sm">
                                        {filteredStudents.map(s => (
                                            <li
                                                key={s.id}
                                                onMouseDown={() => {
                                                    setForm({ ...form, studentId: s.id });
                                                    setStudentSearch(`${s.full_name} - ${s.student_code}`);
                                                    setShowStudentDropdown(false);
                                                }}
                                                className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-gray-700"
                                            >
                                                {s.full_name} <span className="text-gray-400 text-xs">- {s.student_code}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {!form.studentId && studentSearch && !showStudentDropdown && (
                                    <p className="text-xs text-amber-500 mt-1">Selecciona un estudiante de la lista</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Curso</label>
                                <select
                                    value={form.groupId}
                                    onChange={(e) => setForm({ ...form, groupId: e.target.value })}
                                    required
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                >
                                    <option value="">Seleccione curso</option>
                                    {groups.map(g => (
                                        <option key={g.id} value={g.id}>{g.full_name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-blue-700 hover:bg-blue-800 text-white font-medium btn-press py-2 px-5 rounded-lg transition disabled:opacity-50 text-sm"
                        >
                            {loading ? 'Guardando...' : 'Matricular'}
                        </button>
                    </form>
                </div>
            )}

            {activeTab === 'list' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 card-hover overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-wrap justify-between items-center gap-3">
                        <h2 className="text-[15px] font-semibold text-gray-800">Matrículas activas</h2>
                        <div className="flex items-center gap-3">
                            <input
                                type="text"
                                value={listSearch}
                                onChange={e => { setListSearch(e.target.value); setCurrentPage(1); }}
                                placeholder="Buscar por nombre..."
                                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none w-52"
                            />
                            <span className="text-xs text-gray-400">{filteredEnrollments.length} matrícula{filteredEnrollments.length !== 1 ? 's' : ''}</span>
                            <button onClick={loadEnrollments} className="text-gray-500 hover:text-gray-700 text-sm transition">
                                Actualizar
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">Folio</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Curso</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estudiante</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {currentEnrollments.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-5 py-8 text-center text-gray-400 text-sm">
                                            No hay matrículas registradas
                                        </td>
                                    </tr>
                                ) : (
                                    currentEnrollments.map(e => (
                                        <tr key={e.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-5 py-3 text-center font-bold text-gray-700">
                                                {e.folio_number || '-'}
                                            </td>
                                            <td className="px-5 py-3 font-medium text-gray-800">{e.group_name || '-'}</td>
                                            <td className="px-5 py-3 text-gray-700">{e.student_name || '-'}</td>
                                            <td className="px-5 py-3 text-gray-500">{e.student_code || '-'}</td>
                                            <td className="px-5 py-3">
                                                <button
                                                    onClick={() => handleDeleteClick(e.id)}
                                                    className="text-red-400 hover:text-red-500 text-sm font-medium transition"
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
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
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

            <ConfirmDialog
                isOpen={showConfirm}
                onClose={cancelDelete}
                onConfirm={confirmDelete}
                title="Eliminar matrícula"
                message="¿Estás seguro de que deseas eliminar esta matrícula? Esta acción no se puede deshacer."
                confirmText="Eliminar"
                cancelText="Cancelar"
            />
        </div>
    );
};

export default Enrollments;

