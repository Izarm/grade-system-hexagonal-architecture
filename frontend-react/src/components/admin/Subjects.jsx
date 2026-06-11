import { useState, useEffect } from 'react';
import api from '../../api/client';
import ConfirmDialog from '../common/ConfirmDialog';
import { useRefresh } from '../../contexts/RefreshContext';

const Subjects = () => {
    const { refreshKey, refresh } = useRefresh();
    const [subjects, setSubjects] = useState([]);
    const [form, setForm] = useState({ id: '', name: '', area: '' });
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [subjectToDelete, setSubjectToDelete] = useState(null);
    const [activeTab, setActiveTab] = useState('create');

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentSubjects = subjects.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(subjects.length / itemsPerPage);

    const loadSubjects = async (resetPage = true) => {
        try {
            const res = await api.get('/subjects');
            const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
            setSubjects(data);
            if (resetPage) setCurrentPage(1);
        } catch (error) {
            console.error('Error cargando asignaturas:', error);
            setSubjects([]);
        }
    };

    useEffect(() => {
        loadSubjects();
    }, [refreshKey]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name || !form.area) {
            setMessage({ type: 'error', text: 'Nombre y área son obligatorios' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }
        setLoading(true);
        setMessage(null);
        try {
            if (form.id) {
                await api.put(`/subjects/${form.id}`, { name: form.name, area: form.area });
                setMessage({ type: 'success', text: 'Asignatura actualizada' });
            } else {
                await api.post('/subjects', { name: form.name, area: form.area });
                setMessage({ type: 'success', text: 'Asignatura creada' });
            }
            setForm({ id: '', name: '', area: '' });
            refresh();
            setActiveTab('list');
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message;
            setMessage({ type: 'error', text: errorMsg });
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleEdit = (subject) => {
        setForm({ id: subject.id, name: subject.name, area: subject.area });
        setActiveTab('create');
    };

    const handleDeleteClick = (id) => {
        setSubjectToDelete(id);
        setShowConfirm(true);
    };

    const confirmDelete = async () => {
        if (subjectToDelete) {
            try {
                await api.delete(`/subjects/${subjectToDelete}`);
                loadSubjects(false);
                setMessage({ type: 'success', text: 'Asignatura eliminada' });
            } catch (err) {
                setMessage({ type: 'error', text: err.response?.data?.message || 'Error al eliminar' });
            }
            setTimeout(() => setMessage(null), 3000);
        }
        setShowConfirm(false);
        setSubjectToDelete(null);
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
                    {form.id ? 'Editar asignatura' : 'Crear asignatura'}
                </button>
                <button
                    onClick={() => setActiveTab('list')}
                    className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                        activeTab === 'list'
                            ? 'border-blue-700 text-blue-700'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    Listado de asignaturas
                </button>
            </div>

            {activeTab === 'create' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 card-hover">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h2 className="text-[15px] font-semibold text-gray-800">
                            {form.id ? 'Editar asignatura' : 'Crear asignatura'}
                        </h2>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Nombre de la asignatura</label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="Ej: Matemáticas, Español, Inglés"
                                required
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Área</label>
                            <select
                                value={form.area}
                                onChange={(e) => setForm({ ...form, area: e.target.value })}
                                required
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                            >
                                <option value="">Seleccione un área</option>
                                <option value="Académica">Académica</option>
                                <option value="Electiva">Electiva</option>
                            </select>
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
                                        setForm({ id: '', name: '', area: '' });
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
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                        <h2 className="text-[15px] font-semibold text-gray-800">Listado de asignaturas</h2>
                        <button
                            onClick={loadSubjects}
                            className="text-gray-500 hover:text-gray-700 text-sm transition"
                        >
                            Actualizar
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Área</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {currentSubjects.length === 0 ? (
                                    <tr>
                                        <td colSpan="3" className="px-5 py-8 text-center text-gray-400 text-sm">
                                            No hay asignaturas registradas
                                        </td>
                                    </tr>
                                ) : (
                                    currentSubjects.map((subject) => (
                                        <tr key={subject.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-5 py-3 font-medium text-gray-800">{subject.name}</td>
                                            <td className="px-5 py-3">
                                                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                                    subject.area === 'Académica'
                                                        ? 'bg-blue-100 text-blue-700'
                                                        : 'bg-purple-100 text-purple-700'
                                                }`}>
                                                    {subject.area}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleEdit(subject)}
                                                        className="text-blue-700 hover:text-blue-700 text-sm font-medium transition"
                                                    >
                                                        Editar
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteClick(subject.id)}
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
                title="Eliminar asignatura"
                message="¿Estás seguro de que deseas eliminar esta asignatura? Esta acción no se puede deshacer."
                confirmText="Eliminar"
                cancelText="Cancelar"
            />
        </div>
    );
};

export default Subjects;

