import { useState, useEffect } from 'react';
import api from '../../api/client';
import ConfirmDialog from '../common/ConfirmDialog';
import { useRefresh } from '../../contexts/RefreshContext';

const Students = () => {
    const { refreshKey, refresh } = useRefresh();
    const [students, setStudents] = useState([]);
    const [form, setForm] = useState({ id: '', fullName: '', studentCode: '' });
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [studentToDelete, setStudentToDelete] = useState(null);
    const [activeTab, setActiveTab] = useState('create');

    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);

    const normalize = (str) => str?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') || '';
    const filteredStudents = students.filter(s => normalize(s.full_name).includes(normalize(search)));
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentStudents = filteredStudents.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);

    const loadStudents = async (resetPage = true) => {
        try {
            const res = await api.get('/students');
            const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
            setStudents(data);
            if (resetPage) setCurrentPage(1);
        } catch (error) {
            console.error('Error cargando estudiantes:', error);
            setStudents([]);
        }
    };

    useEffect(() => {
        loadStudents();
    }, [refreshKey]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.fullName || !form.studentCode) {
            setMessage({ type: 'error', text: 'Nombre y código son obligatorios' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }
        setLoading(true);
        setMessage(null);
        try {
            if (form.id) {
                await api.put(`/students/${form.id}`, { fullName: form.fullName, studentCode: form.studentCode });
                setMessage({ type: 'success', text: 'Estudiante actualizado' });
            } else {
                await api.post('/students', { fullName: form.fullName, studentCode: form.studentCode });
                setMessage({ type: 'success', text: 'Estudiante creado' });
            }
            setForm({ id: '', fullName: '', studentCode: '' });
            refresh();
            setActiveTab('list');
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message;
            if (errorMsg.includes('duplicate') || errorMsg.includes('Ya existe')) {
                setMessage({ type: 'error', text: 'Ya existe un estudiante con este código' });
            } else {
                setMessage({ type: 'error', text: errorMsg });
            }
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleEdit = (student) => {
        setForm({ id: student.id, fullName: student.full_name, studentCode: student.student_code });
        setActiveTab('create');
    };

    const handleDeleteClick = (id) => {
        setStudentToDelete(id);
        setShowConfirm(true);
    };

    const confirmDelete = async () => {
        if (studentToDelete) {
            setLoading(true);
            try {
                // 1. Obtener las matrículas del estudiante
                const enrollmentsRes = await api.get(`/enrollments?studentId=${studentToDelete}`);
                const enrollments = Array.isArray(enrollmentsRes.data) ? enrollmentsRes.data : (enrollmentsRes.data.data || []);

                // 2. Eliminar cada matrícula (soft delete)
                for (const enrollment of enrollments) {
                    await api.delete(`/enrollments/${enrollment.id}`);
                }

                // 3. Eliminar el estudiante (soft delete)
                await api.delete(`/students/${studentToDelete}`);

                setMessage({ type: 'success', text: 'Estudiante y sus matrículas eliminados' });
                loadStudents(false);
            } catch (err) {
                console.error('Error al eliminar:', err);
                setMessage({ type: 'error', text: err.response?.data?.message || 'Error al eliminar' });
            } finally {
                setLoading(false);
                setTimeout(() => setMessage(null), 3000);
            }
        }
        setShowConfirm(false);
        setStudentToDelete(null);
    };

    const cancelDelete = () => setShowConfirm(false);

    const goToPage = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
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
                    {form.id ? 'Editar estudiante' : 'Crear estudiante'}
                </button>
                <button
                    onClick={() => setActiveTab('list')}
                    className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                        activeTab === 'list'
                            ? 'border-blue-700 text-blue-700'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    Listado de estudiantes
                </button>
            </div>

            {activeTab === 'create' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 card-hover">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h2 className="text-[15px] font-semibold text-gray-800">
                            {form.id ? 'Editar estudiante' : 'Crear estudiante'}
                        </h2>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Nombre completo</label>
                            <input
                                type="text"
                                value={form.fullName}
                                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                                placeholder="Ej: Juan Pérez"
                                required
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Código de estudiante</label>
                            <input
                                type="text"
                                value={form.studentCode}
                                onChange={(e) => setForm({ ...form, studentCode: e.target.value })}
                                placeholder="Ej: 2024001"
                                required
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-blue-700 hover:bg-blue-800 text-white font-medium btn-press py-2 px-5 rounded-lg transition disabled:opacity-50 text-sm"
                            >
                                {loading ? 'Guardando...' : (form.id ? 'Actualizar' : 'Crear')}
                            </button>
                            {form.id && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setForm({ id: '', fullName: '', studentCode: '' });
                                        setActiveTab('list');
                                    }}
                                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-5 rounded-lg transition text-sm"
                                >
                                    Cancelar
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            )}

            {activeTab === 'list' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 card-hover overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-wrap justify-between items-center gap-3">
                        <h2 className="text-[15px] font-semibold text-gray-800">Listado de estudiantes</h2>
                        <div className="flex items-center gap-3">
                            <input
                                type="text"
                                value={search}
                                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                                placeholder="Buscar por nombre..."
                                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none w-52"
                            />
                            <span className="text-xs text-gray-400">{filteredStudents.length} estudiante{filteredStudents.length !== 1 ? 's' : ''}</span>
                            <button onClick={loadStudents} className="text-gray-500 hover:text-gray-700 text-sm transition">
                                Actualizar
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {currentStudents.length === 0 ? (
                                    <tr>
                                        <td colSpan="3" className="px-5 py-8 text-center text-gray-400 text-sm">
                                            No hay estudiantes registrados
                                        </td>
                                    </tr>
                                ) : (
                                    currentStudents.map((student) => (
                                        <tr key={student.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-5 py-3 font-medium text-gray-800">{student.full_name}</td>
                                            <td className="px-5 py-3">
                                                <span className="text-gray-600">{student.student_code}</span>
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleEdit(student)}
                                                        className="text-blue-700 hover:text-blue-700 text-sm font-medium transition"
                                                    >
                                                        Editar
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteClick(student.id)}
                                                        className="text-red-400 hover:text-red-500 text-sm font-medium transition"
                                                    >
                                                        Eliminar
                                                    </button>
                                                </div>
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
                title="Eliminar estudiante"
                message="¿Estás seguro de que deseas eliminar este estudiante? Esta acción también eliminará todas sus matrículas."
                confirmText="Eliminar"
                cancelText="Cancelar"
            />
        </div>
    );
};

export default Students;

