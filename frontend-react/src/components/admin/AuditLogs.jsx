import { useState, useEffect, useCallback } from 'react';
import api from '../../api/client';

const PAGE_SIZE = 50;
const normalizeStr = (str) => str?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') || '';

const AuditLogs = () => {
    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({ teacherId: '', studentId: '', periodId: '' });
    const [teachers, setTeachers] = useState([]);
    const [periods, setPeriods] = useState([]);
    const [search, setSearch] = useState('');

    const loadMeta = async () => {
        try {
            const [tRes, pRes] = await Promise.all([
                api.get('/users?role=docente'),
                api.get('/periods'),
            ]);
            const t = Array.isArray(tRes.data) ? tRes.data : (tRes.data?.data || []);
            const p = Array.isArray(pRes.data) ? pRes.data : (pRes.data?.data || []);
            setTeachers(t);
            setPeriods(p);
        } catch { }
    };

    const loadLogs = useCallback(async (p = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: p, limit: PAGE_SIZE });
            if (filters.teacherId) params.append('teacherId', filters.teacherId);
            if (filters.studentId) params.append('studentId', filters.studentId);
            if (filters.periodId) params.append('periodId', filters.periodId);
            const res = await api.get(`/audit-logs?${params}`);
            setLogs(res.data.data || []);
            setTotal(res.data.total || 0);
        } catch {
            setLogs([]);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => { loadMeta(); }, []);
    useEffect(() => { setPage(1); loadLogs(1); }, [filters]);

    const actionLabel = (a) => ({ create: 'Creó', update: 'Editó', delete: 'Eliminó' }[a] || a);
    const fieldLabel = (f) => ({ normal_note: 'Nota normal', aptitudinal_note: 'Nota actitudinal', absences: 'Faltas', average: 'Promedio' }[f] || f);

    const totalPages = Math.ceil(total / PAGE_SIZE);

    const displayed = search
        ? logs.filter(l =>
            normalizeStr(l.student_name).includes(normalizeStr(search)) ||
            normalizeStr(l.teacher_name).includes(normalizeStr(search)) ||
            normalizeStr(l.subject_name).includes(normalizeStr(search)))
        : logs;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por estudiante, docente o materia..."
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none flex-1 min-w-[220px]"
                />
                <select
                    value={filters.teacherId}
                    onChange={e => setFilters(f => ({ ...f, teacherId: e.target.value }))}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                >
                    <option value="">Todos los docentes</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <select
                    value={filters.periodId}
                    onChange={e => setFilters(f => ({ ...f, periodId: e.target.value }))}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                >
                    <option value="">Todos los períodos</option>
                    {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button
                    onClick={() => { setFilters({ teacherId: '', studentId: '', periodId: '' }); setSearch(''); }}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition"
                >
                    Limpiar filtros
                </button>
                <span className="ml-auto text-xs text-gray-400 self-center">
                    {total.toLocaleString('es-CO')} registros
                </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 text-left">
                            <th className="px-4 py-3 text-xs font-medium text-gray-500">Fecha</th>
                            <th className="px-4 py-3 text-xs font-medium text-gray-500">Docente</th>
                            <th className="px-4 py-3 text-xs font-medium text-gray-500">Estudiante</th>
                            <th className="px-4 py-3 text-xs font-medium text-gray-500">Materia</th>
                            <th className="px-4 py-3 text-xs font-medium text-gray-500">Período</th>
                            <th className="px-4 py-3 text-xs font-medium text-gray-500">Acción</th>
                            <th className="px-4 py-3 text-xs font-medium text-gray-500">Campo</th>
                            <th className="px-4 py-3 text-xs font-medium text-gray-500">Antes</th>
                            <th className="px-4 py-3 text-xs font-medium text-gray-500">Después</th>
                        </tr>
                    </thead>
                    {loading ? (
                        <tbody>
                            {Array.from({ length: 8 }).map((_, i) => (
                                <tr key={i} className="border-t border-gray-50 animate-pulse">
                                    {Array.from({ length: 9 }).map((_, j) => (
                                        <td key={j} className="px-4 py-3">
                                            <div className="h-3 bg-gray-100 rounded w-3/4" />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    ) : displayed.length === 0 ? (
                        <tbody>
                            <tr>
                                <td colSpan={9} className="px-4 py-12 text-center text-gray-400 text-sm">
                                    No hay registros de auditoría con los filtros aplicados
                                </td>
                            </tr>
                        </tbody>
                    ) : (
                        <tbody>
                            {displayed.map(log => (
                                <tr key={log.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                                        {new Date(log.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                                    </td>
                                    <td className="px-4 py-2.5 text-xs">{log.teacher_name}</td>
                                    <td className="px-4 py-2.5 text-xs">{log.student_name}</td>
                                    <td className="px-4 py-2.5 text-xs">{log.subject_name}</td>
                                    <td className="px-4 py-2.5 text-xs">{log.period_name}</td>
                                    <td className="px-4 py-2.5">
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                            log.action === 'create' ? 'bg-green-100 text-green-700' :
                                            log.action === 'update' ? 'bg-blue-100 text-blue-700' :
                                            'bg-red-100 text-red-700'
                                        }`}>
                                            {actionLabel(log.action)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-xs text-gray-600">{fieldLabel(log.field)}</td>
                                    <td className="px-4 py-2.5 text-xs text-gray-400 line-through">{log.old_value ?? '—'}</td>
                                    <td className="px-4 py-2.5 text-xs font-medium text-gray-700">{log.new_value ?? '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    )}
                </table>
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <button
                        disabled={page === 1}
                        onClick={() => { const p = page - 1; setPage(p); loadLogs(p); }}
                        className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition"
                    >
                        ← Anterior
                    </button>
                    <span className="text-xs text-gray-500">Página {page} de {totalPages}</span>
                    <button
                        disabled={page >= totalPages}
                        onClick={() => { const p = page + 1; setPage(p); loadLogs(p); }}
                        className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition"
                    >
                        Siguiente →
                    </button>
                </div>
            )}
        </div>
    );
};

export default AuditLogs;
