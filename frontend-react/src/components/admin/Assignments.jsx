import { useState, useEffect } from 'react';
import api from '../../api/client';
import ConfirmDialog from '../common/ConfirmDialog';
import { useActiveAcademicYear } from '../../hooks/useActiveAcademicYear';
import { useRefresh } from '../../contexts/RefreshContext';

const Assignments = () => {
    const { refreshKey } = useRefresh();
    const [assignments, setAssignments] = useState([]);
    const [groups, setGroups] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [form, setForm] = useState({ id: '', groupId: '', subjectId: '', teacherId: '', weeklyHours: '' });
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [assignmentToDelete, setAssignmentToDelete] = useState(null);
    const [activeTab, setActiveTab] = useState('create');
    const [searchTeacher, setSearchTeacher] = useState('');
    const [openSelect, setOpenSelect] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [isElective, setIsElective] = useState(false);

    // Paginación listado
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentAssignments = assignments.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(assignments.length / itemsPerPage);

    // Estado tab "Por grado"
    const [bulkGradeId, setBulkGradeId] = useState('');
    const [bulkRows, setBulkRows] = useState([]);
    const [bulkSearchTeacher, setBulkSearchTeacher] = useState({});
    const [bulkOpenSelect, setBulkOpenSelect] = useState(null);
    const [bulkSaving, setBulkSaving] = useState(false);

    const { activeYear, loading: yearLoading } = useActiveAcademicYear();

    const extractData = (response) => {
        if (!response) return [];
        if (response.data && Array.isArray(response.data)) return response.data;
        if (Array.isArray(response)) return response;
        if (response.data && response.data.data && Array.isArray(response.data.data)) return response.data.data;
        return [];
    };

    const getGradeNumber = (gradeName) => {
        if (!gradeName) return 999;
        const match = gradeName.match(/(\d+)/);
        return match ? parseInt(match[0]) : 999;
    };

    const getGradeLetter = (gradeName) => {
        if (!gradeName) return '';
        const match = gradeName.match(/[A-Z]+$/);
        return match ? match[0] : '';
    };

    const loadData = async (resetPage = true) => {
        setLoading(true);
        try {
            if (activeYear) {
                const assignRes = await api.get(`/subject-assignments?academicYearId=${activeYear.id}`);
                let assignmentsData = extractData(assignRes.data);
                if (assignmentsData.assignments) assignmentsData = assignmentsData.assignments;
                setAssignments(assignmentsData);
                if (resetPage) setCurrentPage(1);
            }

            const groupsRes = await api.get('/groups');
            const groupsData = extractData(groupsRes.data);
            const gradesRes = await api.get('/grades');
            let gradesData = extractData(gradesRes.data);

            try {
                const gradesAllRes = await api.get('/grades?all=true');
                const gradesAllData = extractData(gradesAllRes.data);
                if (gradesAllData.length > gradesData.length) gradesData = gradesAllData;
            } catch (e) { /* usar solo activos */ }

            const gradeMap = {};
            gradesData.forEach(g => { gradeMap[g.id] = g.name; });

            const groupsWithDisplay = groupsData.map(group => ({
                ...group,
                grade_name: gradeMap[group.grade_id] || `Grado ${group.grade_id}`,
                displayName: gradeMap[group.grade_id] || `Grado ${group.grade_id}`
            }));

            groupsWithDisplay.sort((a, b) => {
                const numA = getGradeNumber(a.displayName);
                const numB = getGradeNumber(b.displayName);
                if (numA !== numB) return numA - numB;
                const order = { A:1, B:2, C:3, D:4, E:5, F:6, G:7, H:8, I:9, J:10 };
                return (order[getGradeLetter(a.displayName)] || 99) - (order[getGradeLetter(b.displayName)] || 99);
            });

            setGroups(groupsWithDisplay);

            const subsRes = await api.get('/subjects');
            setSubjects(extractData(subsRes.data));

            const usersRes = await api.get('/users');
            setTeachers(extractData(usersRes.data).filter(u => u.role === 'docente'));
        } catch (error) {
            console.error('Error cargando datos:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeYear) loadData(false);
    }, [activeYear, refreshKey]);

    // ─── Cargar filas al seleccionar grado en "Por grado" ───────────────────
    useEffect(() => {
        if (!bulkGradeId || !activeYear) return;
        const academicSubjects = subjects.filter(s => s.area !== 'Electiva');
        const existingForGrade = assignments.filter(a => {
            const group = groups.find(g => g.id === a.group_id);
            return group && group.id === parseInt(bulkGradeId);
        });

        const rows = academicSubjects.map(subject => {
            const existing = existingForGrade.find(a => a.subject_id === subject.id);
            return {
                subjectId: subject.id,
                subjectName: subject.name,
                teacherId: existing ? existing.teacher_id : '',
                weeklyHours: existing ? (existing.weekly_hours ?? '') : '',
                assignmentId: existing ? existing.id : null
            };
        });
        setBulkRows(rows);
        setBulkSearchTeacher({});
        setBulkOpenSelect(null);
    }, [bulkGradeId, subjects, assignments, groups, activeYear]);

    // ─── Guardar masivamente por grado ──────────────────────────────────────
    const handleBulkSave = async () => {
        const rowsToSave = bulkRows.filter(r => r.teacherId !== '');
        if (rowsToSave.length === 0) {
            setMessage({ type: 'error', text: 'Asigna al menos un docente' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }
        setBulkSaving(true);
        try {
            const results = await Promise.allSettled(rowsToSave.map(async row => {
                const payload = {
                    academicYearId: activeYear.id,
                    subjectId: row.subjectId,
                    teacherId: parseInt(row.teacherId),
                    groupId: parseInt(bulkGradeId),
                    isElective: false,
                    weeklyHours: row.weeklyHours !== '' ? parseInt(row.weeklyHours) : null
                };
                if (row.assignmentId) {
                    return api.put(`/subject-assignments/${row.assignmentId}`, payload);
                } else {
                    return api.post('/subject-assignments', payload);
                }
            }));

            const failed = results.filter(r => r.status === 'rejected');
            const ok = results.filter(r => r.status === 'fulfilled').length;

            if (failed.length === 0) {
                setMessage({ type: 'success', text: `${ok} asignación(es) guardada(s)` });
            } else {
                setMessage({ type: 'error', text: `${ok} guardadas, ${failed.length} fallaron (posibles duplicados)` });
            }
            setTimeout(() => setMessage(null), 4000);
            await loadData(false);
        } catch (err) {
            setMessage({ type: 'error', text: 'Error al guardar' });
            setTimeout(() => setMessage(null), 3000);
        } finally {
            setBulkSaving(false);
        }
    };

    // ─── Formulario individual ───────────────────────────────────────────────
    const handleSubjectChange = (e) => {
        const subjectId = e.target.value;
        const subject = subjects.find(s => s.id.toString() === subjectId);
        setSelectedSubject(subject);
        setIsElective(true);
        setForm(prev => ({ ...prev, subjectId, groupId: '' }));
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);
        try {
            if (!form.subjectId || !form.teacherId) {
                setMessage({ type: 'error', text: 'Asignatura y docente son obligatorios' });
                return;
            }
            const payload = {
                academicYearId: activeYear.id,
                subjectId: parseInt(form.subjectId),
                teacherId: parseInt(form.teacherId),
                isElective,
                weeklyHours: form.weeklyHours !== '' ? parseInt(form.weeklyHours) : null
            };
            if (!isElective && !form.groupId) {
                setMessage({ type: 'error', text: 'Para asignaturas regulares, seleccione un grado' });
                return;
            }
            if (!isElective) payload.groupId = parseInt(form.groupId);

            const isEdit = !!form.id;
            if (isEdit) {
                await api.put(`/subject-assignments/${form.id}`, payload);
                setMessage({ type: 'success', text: 'Asignación actualizada' });
            } else {
                await api.post('/subject-assignments', payload);
                setMessage({ type: 'success', text: 'Asignación creada' });
            }
            setForm({ id: '', groupId: '', subjectId: '', teacherId: '', weeklyHours: '' });
            setSelectedSubject(null);
            setIsElective(false);
            setEditingId(null);
            loadData(!isEdit);
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Error al guardar' });
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleEdit = (assignment) => {
        const subject = subjects.find(s => s.id === (assignment.subject_id || assignment.subjectId));
        const isElectiveSubject = subject?.is_elective === 1 || subject?.area === 'Electiva';
        setIsElective(isElectiveSubject);
        setSelectedSubject(subject);
        setForm({
            id: assignment.id,
            groupId: assignment.group_id || '',
            subjectId: assignment.subject_id || assignment.subjectId,
            teacherId: assignment.teacher_id || assignment.teacherId,
            weeklyHours: assignment.weekly_hours != null ? assignment.weekly_hours : ''
        });
        setEditingId(assignment.id);
        setActiveTab('create');
    };

    const handleDeleteClick = (id) => { setAssignmentToDelete(id); setShowConfirm(true); };

    const confirmDelete = async () => {
        if (assignmentToDelete) {
            try {
                await api.delete(`/subject-assignments/${assignmentToDelete}`);
                loadData(false);
                setMessage({ type: 'success', text: 'Asignación eliminada' });
                setTimeout(() => setMessage(null), 3000);
            } catch (err) {
                setMessage({ type: 'error', text: err.response?.data?.message || 'Error al eliminar' });
                setTimeout(() => setMessage(null), 3000);
            }
        }
        setShowConfirm(false);
        setAssignmentToDelete(null);
    };

    const goToPage = (page) => {
        if (page >= 1 && page <= totalPages) setCurrentPage(page);
    };

    const normalize = (str) => str?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') || '';

    const filteredTeachers = teachers.filter(t =>
        normalize(t.name).includes(normalize(searchTeacher))
    );

    const getTeacherName = (teacherId) => {
        const teacher = teachers.find(t => t.id === teacherId);
        return teacher ? teacher.name : 'Sin docente';
    };

    if (yearLoading) return <div className="flex justify-center py-8">Cargando año activo...</div>;
    if (!activeYear) return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <p className="text-blue-700">Para usar este módulo primero crea un año lectivo en <strong>Años lectivos</strong>.</p>
        </div>
    );

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
                <p className="text-sm text-blue-700">Año lectivo activo: <strong>{activeYear.name}</strong></p>
            </div>

            {/* Tabs */}
            <div className="flex mb-6 border-b border-gray-200">
                {[
                    { id: 'create', label: editingId ? 'Editar asignación' : 'Electivas' },
                    { id: 'bulk', label: 'Por grado' },
                    { id: 'list', label: 'Listado' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                            activeTab === tab.id
                                ? 'border-blue-700 text-blue-700'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── TAB: Individual (Electivas) ──────────────────────────────── */}
            {activeTab === 'create' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 card-hover">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h2 className="text-[15px] font-semibold text-gray-800">
                            {editingId ? 'Editar asignación electiva' : 'Asignar materia electiva'}
                        </h2>
                        <p className="text-xs text-purple-600 mt-1">Las materias electivas aplican a todos los grados del colegio</p>
                    </div>
                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Materia electiva</label>
                            <select name="subjectId" value={form.subjectId} onChange={handleSubjectChange} required
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm">
                                <option value="">Seleccione materia electiva</option>
                                {subjects.filter(s => s.area === 'Electiva' || s.is_elective === 1).map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Docente</label>
                            <div className="relative">
                                <button type="button" onClick={() => setOpenSelect(openSelect === 'teacher' ? null : 'teacher')}
                                    className="w-full text-left px-3 py-2 border border-gray-200 rounded-lg bg-white flex items-center justify-between text-sm">
                                    <span className={form.teacherId ? 'text-gray-700' : 'text-gray-400'}>{getTeacherName(form.teacherId)}</span>
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                {openSelect === 'teacher' && (
                                    <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-10">
                                        <div className="p-2 border-b border-gray-100">
                                            <input type="text" placeholder="Buscar docente..." value={searchTeacher}
                                                onChange={e => setSearchTeacher(e.target.value)}
                                                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 outline-none" />
                                        </div>
                                        <div className="max-h-48 overflow-y-auto">
                                            <div onClick={() => { setForm({ ...form, teacherId: '' }); setOpenSelect(null); setSearchTeacher(''); }}
                                                className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">Sin docente</div>
                                            {filteredTeachers.map(t => (
                                                <div key={t.id} onClick={() => { setForm({ ...form, teacherId: t.id }); setOpenSelect(null); setSearchTeacher(''); }}
                                                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 ${form.teacherId === t.id ? 'bg-blue-50 text-blue-700' : ''}`}>
                                                    {t.name}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Intensidad horaria (horas semanales)</label>
                            <input type="number" name="weeklyHours" value={form.weeklyHours} onChange={handleChange}
                                min="1" max="40" placeholder="Ej: 4"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm" />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button type="submit" disabled={loading}
                                className="bg-blue-700 hover:bg-blue-800 text-white font-medium btn-press py-2 px-5 rounded-lg transition disabled:opacity-50 text-sm">
                                {loading ? 'Guardando...' : (editingId ? 'Actualizar' : 'Crear')}
                            </button>
                            {editingId && (
                                <button type="button" onClick={() => { setForm({ id:'',groupId:'',subjectId:'',teacherId:'',weeklyHours:'' }); setSelectedSubject(null); setIsElective(false); setEditingId(null); setActiveTab('list'); }}
                                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-5 rounded-lg transition text-sm">
                                    Cancelar
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            )}

            {/* ── TAB: Por grado ──────────────────────────────────────────── */}
            {activeTab === 'bulk' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 card-hover">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h2 className="text-[15px] font-semibold text-gray-800">Asignación masiva por grado</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Selecciona el grado y asigna docente a todas las materias de una vez</p>
                    </div>
                    <div className="p-6">
                        <div className="mb-5">
                            <label className="block text-sm font-medium text-gray-600 mb-1">Grado</label>
                            <select value={bulkGradeId} onChange={e => setBulkGradeId(e.target.value)}
                                className="w-full max-w-xs px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm">
                                <option value="">Seleccione grado</option>
                                {groups.map(g => <option key={g.id} value={g.id}>{g.displayName}</option>)}
                            </select>
                        </div>

                        {bulkGradeId && bulkRows.length === 0 && (
                            <p className="text-sm text-gray-400 py-4">No hay asignaturas académicas registradas.</p>
                        )}

                        {bulkGradeId && bulkRows.length > 0 && (
                            <>
                                <div className="overflow-x-auto rounded-lg border border-gray-100">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-100">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-1/3">Asignatura</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-1/2">Docente</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">Horas/sem</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {bulkRows.map((row, idx) => (
                                                <tr key={row.subjectId} className="hover:bg-gray-50/40">
                                                    <td className="px-4 py-2.5 font-medium text-gray-800">{row.subjectName}</td>
                                                    <td className="px-4 py-2.5">
                                                        <div className="relative">
                                                            <button type="button"
                                                                onClick={() => setBulkOpenSelect(bulkOpenSelect === idx ? null : idx)}
                                                                className="w-full text-left px-3 py-1.5 border border-gray-200 rounded-lg bg-white flex items-center justify-between text-sm min-w-[180px]">
                                                                <span className={row.teacherId ? 'text-gray-700' : 'text-gray-400'}>
                                                                    {row.teacherId ? getTeacherName(row.teacherId) : 'Sin docente'}
                                                                </span>
                                                                <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                                </svg>
                                                            </button>
                                                            {bulkOpenSelect === idx && (
                                                                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                                                                    <div className="p-2 border-b border-gray-100">
                                                                        <input type="text" placeholder="Buscar..."
                                                                            value={bulkSearchTeacher[idx] || ''}
                                                                            onChange={e => setBulkSearchTeacher(prev => ({ ...prev, [idx]: e.target.value }))}
                                                                            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md outline-none focus:ring-1 focus:ring-blue-500"
                                                                            autoFocus />
                                                                    </div>
                                                                    <div className="max-h-44 overflow-y-auto">
                                                                        <div onClick={() => {
                                                                            setBulkRows(prev => prev.map((r, i) => i === idx ? { ...r, teacherId: '' } : r));
                                                                            setBulkOpenSelect(null);
                                                                        }} className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 text-gray-400">Sin docente</div>
                                                                        {teachers
                                                                            .filter(t => normalize(t.name).includes(normalize(bulkSearchTeacher[idx] || '')))
                                                                            .map(t => (
                                                                                <div key={t.id}
                                                                                    onClick={() => {
                                                                                        setBulkRows(prev => prev.map((r, i) => i === idx ? { ...r, teacherId: t.id } : r));
                                                                                        setBulkOpenSelect(null);
                                                                                        setBulkSearchTeacher(prev => ({ ...prev, [idx]: '' }));
                                                                                    }}
                                                                                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 ${row.teacherId === t.id ? 'bg-blue-50 text-blue-700 font-medium' : ''}`}>
                                                                                    {t.name}
                                                                                </div>
                                                                            ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <input type="number" min="1" max="40" placeholder="-"
                                                            value={row.weeklyHours}
                                                            onChange={e => setBulkRows(prev => prev.map((r, i) => i === idx ? { ...r, weeklyHours: e.target.value } : r))}
                                                            className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 text-center" />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="mt-4 flex items-center gap-3">
                                    <button onClick={handleBulkSave} disabled={bulkSaving}
                                        className="bg-blue-700 hover:bg-blue-800 text-white font-medium btn-press py-2 px-6 rounded-lg transition disabled:opacity-50 text-sm">
                                        {bulkSaving ? 'Guardando...' : 'Guardar todo'}
                                    </button>
                                    <span className="text-xs text-gray-400">
                                        {bulkRows.filter(r => r.teacherId).length} de {bulkRows.length} asignaturas con docente
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ── TAB: Listado ─────────────────────────────────────────────── */}
            {activeTab === 'list' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 card-hover overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                        <h2 className="text-[15px] font-semibold text-gray-800">Asignaciones actuales</h2>
                        <button onClick={() => loadData(false)} className="text-gray-500 hover:text-gray-700 text-sm transition">Actualizar</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grado</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asignatura</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Docente</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Horas/sem</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {currentAssignments.length === 0 ? (
                                    <tr><td colSpan="6" className="px-5 py-8 text-center text-gray-400 text-sm">No hay asignaciones para el año {activeYear.name}</td></tr>
                                ) : (
                                    currentAssignments.map(assignment => (
                                        <tr key={assignment.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-5 py-3">
                                                {assignment.is_elective
                                                    ? <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">Electiva</span>
                                                    : <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Regular</span>}
                                            </td>
                                            <td className="px-5 py-3 font-medium text-gray-800">{assignment.is_elective ? 'Todos' : (assignment.grade_name || '-')}</td>
                                            <td className="px-5 py-3 text-gray-600">{assignment.subject_name || '-'}</td>
                                            <td className="px-5 py-3 text-gray-600">{assignment.teacher_name || '-'}</td>
                                            <td className="px-5 py-3 text-gray-600">{assignment.weekly_hours != null ? `${assignment.weekly_hours} h` : '-'}</td>
                                            <td className="px-5 py-3">
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleEdit(assignment)} className="text-blue-700 hover:text-blue-800 text-sm font-medium transition">Editar</button>
                                                    <button onClick={() => handleDeleteClick(assignment.id)} className="text-red-400 hover:text-red-500 text-sm font-medium transition">Eliminar</button>
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
                            <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}
                                className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition">Anterior</button>
                            <div className="flex gap-1">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                    <button key={page} onClick={() => goToPage(page)}
                                        className={`w-7 h-7 text-xs rounded-md transition ${currentPage === page ? 'bg-blue-700 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                                        {page}
                                    </button>
                                ))}
                            </div>
                            <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}
                                className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition">Siguiente</button>
                        </div>
                    )}
                </div>
            )}

            <ConfirmDialog
                isOpen={showConfirm}
                onClose={() => setShowConfirm(false)}
                onConfirm={confirmDelete}
                title="Eliminar asignación"
                message="¿Estás seguro de que deseas eliminar esta asignación?"
                confirmText="Eliminar"
                cancelText="Cancelar"
            />
        </div>
    );
};

export default Assignments;
