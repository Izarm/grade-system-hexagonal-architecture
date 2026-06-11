import { useState, useEffect } from 'react';
import api from '../../api/client';
import ConfirmDialog from '../common/ConfirmDialog';
import { useRefresh } from '../../contexts/RefreshContext';

// ── helpers ──────────────────────────────────────────────────────────────────
const normalize = (str) => str?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') || '';

// ── sub-components ────────────────────────────────────────────────────────────

const EditModal = ({ teacher, onClose, onSaved }) => {
    const [form, setForm] = useState({
        name: teacher.name || '',
        document: teacher.document || '',
        email: teacher.email || '',
        phone: teacher.phone || '',
        role: teacher.role || 'docente',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await api.put(`/users/${teacher.id}`, form);
            onSaved();
        } catch (err) {
            setError(err.response?.data?.message || 'Error al actualizar');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-[15px] font-semibold text-gray-800">Editar docente</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                {error && (
                    <div className="mx-6 mt-4 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm">{error}</div>
                )}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Nombre completo</label>
                            <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Documento</label>
                            <input type="text" value={form.document} onChange={e => setForm({...form, document: e.target.value})} required
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Correo</label>
                            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Telefono</label>
                            <input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Rol</label>
                            <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm">
                                <option value="docente">Docente</option>
                                <option value="admin">Administrador</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-3 pt-1">
                        <button type="submit" disabled={loading}
                            className="bg-blue-700 hover:bg-blue-800 text-white font-medium py-2 px-5 rounded-lg transition disabled:opacity-50 text-sm">
                            {loading ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                        <button type="button" onClick={onClose}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-5 rounded-lg transition text-sm">
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const TeacherList = ({ refreshKey }) => {
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState(null);
    const [editTeacher, setEditTeacher] = useState(null);
    const [deleteTeacher, setDeleteTeacher] = useState(null);
    const [message, setMessage] = useState(null);
    const [showConfirm, setShowConfirm] = useState(false);

    const notify = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 3000);
    };

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get('/users/teachers');
            setTeachers(Array.isArray(res.data) ? res.data : []);
        } catch { setTeachers([]); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [refreshKey]);

    const handleDelete = async () => {
        if (!deleteTeacher) return;
        try {
            await api.delete(`/users/${deleteTeacher.id}`);
            notify('success', 'Docente eliminado correctamente');
            load();
        } catch (err) {
            notify('error', err.response?.data?.message || 'Error al eliminar');
        }
        setShowConfirm(false);
        setDeleteTeacher(null);
    };

    const filtered = teachers.filter(t => normalize(t.name).includes(normalize(search)));

    if (loading) return (
        <div className="flex justify-center items-center py-16">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-gray-400 text-sm">Cargando docentes...</span>
        </div>
    );

    return (
        <div>
            {message && (
                <div className={`fixed top-5 right-5 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm ${message.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                    {message.text}
                </div>
            )}

            {editTeacher && (
                <EditModal
                    teacher={editTeacher}
                    onClose={() => setEditTeacher(null)}
                    onSaved={() => { setEditTeacher(null); notify('success', 'Docente actualizado'); load(); }}
                />
            )}

            <div className="mb-4 flex items-center gap-3">
                <input
                    type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar docente..."
                    className="w-full max-w-xs px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                />
                <span className="text-xs text-gray-400">{filtered.length} docente{filtered.length !== 1 ? 's' : ''}</span>
            </div>

            {filtered.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-10">No hay docentes aprobados</p>
            ) : (
                <div className="space-y-2">
                    {filtered.map(teacher => {
                        const isOpen = expanded === teacher.id;
                        const academicAssign = teacher.assignments.filter(a => !a.is_elective);
                        const electiveAssign = teacher.assignments.filter(a => a.is_elective);
                        const dirGrades = teacher.director_grades || [];

                        const byGroup = {};
                        for (const a of academicAssign) {
                            const key = `Grado ${a.grade_name || '?'}`;
                            if (!byGroup[key]) byGroup[key] = [];
                            byGroup[key].push(a.subject_name);
                        }

                        return (
                            <div key={teacher.id} className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                                {/* header row */}
                                <div className="w-full flex items-center justify-between px-5 py-3.5 bg-white hover:bg-gray-50/60 transition-colors">
                                    <button
                                        onClick={() => setExpanded(isOpen ? null : teacher.id)}
                                        className="flex items-center gap-4 flex-1 text-left"
                                    >
                                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm flex-shrink-0">
                                            {teacher.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">{teacher.name}</p>
                                            <p className="text-xs text-gray-400">{teacher.email}</p>
                                        </div>
                                    </button>
                                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                                        {dirGrades.map(g => (
                                            <span key={g} className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                                Dir. {g}°
                                            </span>
                                        ))}
                                        <span className="text-xs text-gray-400 ml-1">
                                            {teacher.assignments.length} asignación{teacher.assignments.length !== 1 ? 'es' : ''}
                                        </span>
                                        <button
                                            onClick={() => setEditTeacher(teacher)}
                                            className="ml-2 text-blue-600 hover:text-blue-800 text-xs font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition"
                                        >
                                            Editar
                                        </button>
                                        <button
                                            onClick={() => { setDeleteTeacher(teacher); setShowConfirm(true); }}
                                            className="text-red-400 hover:text-red-600 text-xs font-medium px-2 py-1 rounded-lg hover:bg-red-50 transition"
                                        >
                                            Eliminar
                                        </button>
                                        <button onClick={() => setExpanded(isOpen ? null : teacher.id)}>
                                            <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                {/* expanded detail */}
                                {isOpen && (
                                    <div className="border-t border-gray-100 bg-gray-50/40 px-5 py-4 space-y-4">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                            <div>
                                                <span className="text-gray-400 block mb-0.5">Documento</span>
                                                <span className="text-gray-700 font-medium">{teacher.document || '-'}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-400 block mb-0.5">Telefono</span>
                                                <span className="text-gray-700 font-medium">{teacher.phone || '-'}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-400 block mb-0.5">Correo</span>
                                                <span className="text-gray-700 font-medium">{teacher.email}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-400 block mb-0.5">Director de grado</span>
                                                {dirGrades.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                                        {dirGrades.map(g => (
                                                            <span key={g} className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[11px] font-medium">
                                                                Grado {g}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400">Ninguno</span>
                                                )}
                                            </div>
                                        </div>

                                        {Object.keys(byGroup).length > 0 && (
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 mb-2">Materias académicas</p>
                                                <div className="space-y-1.5">
                                                    {Object.entries(byGroup).map(([grp, subjects]) => (
                                                        <div key={grp} className="flex flex-wrap items-start gap-2 text-xs">
                                                            <span className="font-medium text-gray-600 w-20 flex-shrink-0 pt-0.5">{grp}</span>
                                                            <div className="flex flex-wrap gap-1">
                                                                {subjects.map(s => (
                                                                    <span key={s} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{s}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {electiveAssign.length > 0 && (
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 mb-2">Materias electivas</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {electiveAssign.map((a, i) => (
                                                        <span key={i} className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs">{a.subject_name}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {teacher.assignments.length === 0 && (
                                            <p className="text-xs text-gray-400">Sin asignaciones registradas</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <ConfirmDialog
                isOpen={showConfirm}
                onClose={() => { setShowConfirm(false); setDeleteTeacher(null); }}
                onConfirm={handleDelete}
                title="Eliminar docente"
                message={`¿Estás seguro de que deseas eliminar a ${deleteTeacher?.name}? Se eliminarán también todas sus asignaciones y se quitará como director de grado.`}
                confirmText="Eliminar"
                cancelText="Cancelar"
            />
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────

const RegisterForm = ({ onSuccess }) => {
    const [form, setForm] = useState({ name: '', document: '', email: '', phone: '', password: '', role: 'docente' });
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.post('/users/register', form);
            setMessage({ type: 'success', text: res.data.message || 'Usuario registrado exitosamente' });
            setForm({ name: '', document: '', email: '', phone: '', password: '', role: 'docente' });
            onSuccess?.();
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Error al registrar usuario' });
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-[15px] font-semibold text-gray-800">Registrar nuevo usuario</h3>
                <p className="text-xs text-gray-500 mt-0.5">Complete la información para crear un nuevo usuario</p>
            </div>
            {message && (
                <div className={`mx-6 mt-4 px-4 py-2.5 rounded-lg text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                    {message.text}
                </div>
            )}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Nombre completo</label>
                        <input type="text" name="name" value={form.name} onChange={handleChange} required
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm" placeholder="Nombre completo" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Documento</label>
                        <input type="text" name="document" value={form.document} onChange={handleChange} required
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm" placeholder="Documento de identidad" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Correo electrónico</label>
                        <input type="email" name="email" value={form.email} onChange={handleChange} required
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm" placeholder="correo@ejemplo.com" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Teléfono (opcional)</label>
                        <input type="tel" name="phone" value={form.phone} onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm" placeholder="Teléfono de contacto" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Contraseña</label>
                        <input type="password" name="password" value={form.password} onChange={handleChange} required
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm" placeholder="Contraseña" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Rol</label>
                        <select name="role" value={form.role} onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm">
                            <option value="docente">Docente</option>
                            <option value="admin">Administrador</option>
                        </select>
                    </div>
                </div>
                <div className="flex gap-3 pt-1">
                    <button type="submit" disabled={loading}
                        className="bg-blue-700 hover:bg-blue-800 text-white font-medium py-2 px-5 rounded-lg transition disabled:opacity-50 text-sm">
                        {loading ? 'Registrando...' : 'Registrar usuario'}
                    </button>
                    <button type="button" onClick={() => setForm({ name: '', document: '', email: '', phone: '', password: '', role: 'docente' })}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-5 rounded-lg transition text-sm">
                        Limpiar
                    </button>
                </div>
            </form>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────

const PendingList = ({ refreshKey, onApproved }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState(null);
    const [showConfirm, setShowConfirm] = useState(false);
    const [userToReject, setUserToReject] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const indexOfLast = currentPage * itemsPerPage;
    const current = users.slice(indexOfLast - itemsPerPage, indexOfLast);
    const totalPages = Math.ceil(users.length / itemsPerPage);

    const load = async (resetPage = true) => {
        try {
            const res = await api.get('/auth/users/pending');
            const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
            setUsers(data);
            if (resetPage) setCurrentPage(1);
        } catch { setUsers([]); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [refreshKey]);

    const notify = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 3000);
    };

    const approveUser = async (userId) => {
        try {
            await api.put(`/auth/approve/${userId}`);
            notify('success', 'Usuario aprobado exitosamente');
            load(false);
            onApproved?.();
        } catch (err) { notify('error', err.response?.data?.message || 'Error al aprobar'); }
    };

    const confirmReject = async () => {
        if (userToReject) {
            try {
                await api.put(`/auth/reject/${userToReject}`);
                notify('success', 'Usuario rechazado');
                load(false);
            } catch (err) { notify('error', err.response?.data?.message || 'Error al rechazar'); }
        }
        setShowConfirm(false);
        setUserToReject(null);
    };

    if (loading) return (
        <div className="flex justify-center items-center py-16">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-gray-400 text-sm">Cargando pendientes...</span>
        </div>
    );

    if (users.length === 0) return (
        <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-xl border border-gray-100">
            No hay usuarios pendientes de aprobación
        </div>
    );

    return (
        <div>
            {message && (
                <div className={`fixed top-5 right-5 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm ${message.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                    {message.text}
                </div>
            )}

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-[15px] font-semibold text-gray-800">Usuarios pendientes de aprobación</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Revisa y aprueba los nuevos registros</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                {['Nombre','Documento','Correo','Teléfono','Rol','Fecha','Acciones'].map(h => (
                                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {current.map(user => (
                                <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-5 py-3 font-medium text-gray-800">{user.name}</td>
                                    <td className="px-5 py-3 text-gray-600">{user.document}</td>
                                    <td className="px-5 py-3 text-gray-600">{user.email}</td>
                                    <td className="px-5 py-3 text-gray-500">{user.phone || '-'}</td>
                                    <td className="px-5 py-3">
                                        <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                                            {user.role === 'admin' ? 'Administrador' : 'Docente'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-gray-500">{new Date(user.created_at).toLocaleDateString()}</td>
                                    <td className="px-5 py-3">
                                        <div className="flex gap-2">
                                            <button onClick={() => approveUser(user.id)}
                                                className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition">
                                                Aprobar
                                            </button>
                                            <button onClick={() => { setUserToReject(user.id); setShowConfirm(true); }}
                                                className="bg-rose-400 hover:bg-rose-500 text-white px-3 py-1 rounded-lg text-xs font-medium transition">
                                                Rechazar
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 py-4 border-t border-gray-100 bg-gray-50/50">
                        <button onClick={() => setCurrentPage(p => Math.max(p-1,1))} disabled={currentPage===1}
                            className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 transition">Anterior</button>
                        {Array.from({length: totalPages}, (_,i) => i+1).map(p => (
                            <button key={p} onClick={() => setCurrentPage(p)}
                                className={`w-7 h-7 text-xs rounded-md transition ${currentPage===p ? 'bg-blue-700 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                                {p}
                            </button>
                        ))}
                        <button onClick={() => setCurrentPage(p => Math.min(p+1,totalPages))} disabled={currentPage===totalPages}
                            className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 transition">Siguiente</button>
                    </div>
                )}
            </div>

            <ConfirmDialog isOpen={showConfirm} onClose={() => { setShowConfirm(false); setUserToReject(null); }}
                onConfirm={confirmReject} title="Rechazar usuario"
                message="¿Estás seguro de que deseas rechazar este usuario? Esta acción no se puede deshacer."
                confirmText="Rechazar" cancelText="Cancelar" />
        </div>
    );
};

// ── Main component ─────────────────────────────────────────────────────────────

const Teachers = () => {
    const { refreshKey, refresh } = useRefresh();
    const [activeTab, setActiveTab] = useState('list');

    const tabs = [
        { id: 'list',     label: 'Docentes' },
        { id: 'register', label: 'Registrar' },
        { id: 'pending',  label: 'Pendientes' },
    ];

    return (
        <div className="max-w-7xl mx-auto px-6 py-6">
            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-6">
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                            activeTab === tab.id
                                ? 'border-blue-700 text-blue-700'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'list' && <TeacherList refreshKey={refreshKey} />}
            {activeTab === 'register' && (
                <RegisterForm onSuccess={() => { refresh(); setActiveTab('list'); }} />
            )}
            {activeTab === 'pending' && (
                <PendingList refreshKey={refreshKey} onApproved={refresh} />
            )}
        </div>
    );
};

export default Teachers;
