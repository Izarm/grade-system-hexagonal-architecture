import { useState, useEffect } from 'react';
import api from '../../api/client';

const PROMOTION_BADGE = {
    promoted:  { text: 'Promovido',  cls: 'bg-green-100 text-green-700' },
    held_back: { text: 'Repitente',  cls: 'bg-red-100 text-red-700' },
    pending:   { text: 'Pendiente',  cls: 'bg-gray-100 text-gray-500' },
};

export default function History() {
    const [years, setYears]         = useState([]);
    const [yearId, setYearId]       = useState('');
    const [students, setStudents]   = useState([]);
    const [loading, setLoading]     = useState(false);
    const [search, setSearch]       = useState('');
    const [filterGrade, setFilterGrade] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    useEffect(() => {
        api.get('/academic-years')
            .then(r => {
                const list = r.data?.data || r.data || [];
                const sorted = [...list].sort((a, b) =>
                    new Date(b.startDate) - new Date(a.startDate)
                );
                setYears(sorted);
                // Pre-seleccionar el primer año cerrado
                const closed = sorted.find(y => !y.active);
                if (closed) setYearId(String(closed.id));
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (!yearId) { setStudents([]); return; }
        setLoading(true);
        api.get(`/promotions/history/${yearId}`)
            .then(r => setStudents(r.data))
            .catch(() => setStudents([]))
            .finally(() => setLoading(false));
    }, [yearId]);

    const getCourseDisplay = (s) =>
        s.grade_name + (s.group_name && s.group_name !== s.grade_name ? ` ${s.group_name}` : '');

    const grades = [...new Set(students.map(s => getCourseDisplay(s)))].sort();

    const filtered = students.filter(s => {
        const q = search.toLowerCase();
        const matchSearch = !q || s.full_name.toLowerCase().includes(q) || s.student_code.toLowerCase().includes(q);
        const matchGrade  = !filterGrade  || getCourseDisplay(s) === filterGrade;
        const matchStatus = !filterStatus || s.promotion_status === filterStatus;
        return matchSearch && matchGrade && matchStatus;
    });

    const selectedYear = years.find(y => String(y.id) === String(yearId));

    // Estadísticas
    const total     = filtered.length;
    const promoted  = filtered.filter(s => s.promotion_status === 'promoted').length;
    const heldBack  = filtered.filter(s => s.promotion_status === 'held_back').length;
    const avgGlobal = filtered.length
        ? (filtered.reduce((acc, s) => acc + (parseFloat(s.final_average) || 0), 0) / filtered.length).toFixed(1)
        : '—';

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-lg font-bold text-gray-900">Historial académico</h1>
                <p className="text-xs text-gray-500 mt-0.5">
                    Consulta los registros históricos de cualquier año lectivo: estudiantes, promedios y estado de promoción.
                </p>
            </div>

            {/* Selector de año */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">Año lectivo</label>
                <select
                    value={yearId}
                    onChange={e => { setYearId(e.target.value); setSearch(''); setFilterGrade(''); setFilterStatus(''); }}
                    className="w-full sm:w-72 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                    <option value="">Seleccionar año...</option>
                    {years.map(y => (
                        <option key={y.id} value={y.id}>
                            {y.name} {y.active ? '(activo)' : '(cerrado)'}
                        </option>
                    ))}
                </select>
            </div>

            {/* Estadísticas resumen */}
            {!loading && students.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: 'Total estudiantes', value: total,    color: 'blue' },
                        { label: 'Promovidos',         value: promoted, color: 'green' },
                        { label: 'Repitentes',         value: heldBack, color: 'red' },
                        { label: 'Prom. general',      value: avgGlobal, color: 'purple' },
                    ].map(item => (
                        <div key={item.label} className={`bg-${item.color}-50 border border-${item.color}-100 rounded-xl p-4`}>
                            <div className={`text-2xl font-bold text-${item.color}-700`}>{item.value}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Filtros y tabla */}
            {yearId && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    {/* Barra de filtros */}
                    <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap gap-3 items-center">
                        <input
                            type="text"
                            placeholder="Buscar por nombre o código..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        {grades.length > 1 && (
                            <select
                                value={filterGrade}
                                onChange={e => setFilterGrade(e.target.value)}
                                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                            >
                                <option value="">Todos los grados</option>
                                {grades.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        )}
                        <select
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                        >
                            <option value="">Todos los estados</option>
                            <option value="promoted">Promovidos</option>
                            <option value="held_back">Repitentes</option>
                            <option value="pending">Pendientes</option>
                        </select>
                        <span className="ml-auto text-xs text-gray-400">
                            {filtered.length} de {students.length} estudiantes
                            {selectedYear ? ` — Año ${selectedYear.name}` : ''}
                        </span>
                    </div>

                    {/* Tabla */}
                    {loading ? (
                        <div className="py-14 text-center">
                            <div className="inline-flex items-center gap-2 text-sm text-gray-400">
                                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                </svg>
                                Cargando historial...
                            </div>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-14 text-center text-sm text-gray-400">
                            {students.length === 0 ? 'No hay datos para este año' : 'Ningún resultado coincide con los filtros'}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estudiante</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grado</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Prom. Final</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Faltas</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Folio</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filtered.map(s => {
                                        const avg = parseFloat(s.final_average);
                                        const badge = PROMOTION_BADGE[s.promotion_status] || PROMOTION_BADGE.pending;
                                        return (
                                            <tr key={s.enrollment_id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-5 py-3">
                                                    <div className="font-medium text-gray-900">{s.full_name}</div>
                                                    <div className="text-xs text-gray-400">{s.student_code}</div>
                                                </td>
                                                <td className="px-4 py-3 text-gray-600">
                                                    {s.grade_name}{s.group_name && s.group_name !== s.grade_name ? ` ${s.group_name}` : ''}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {s.records_count > 0 ? (
                                                        <span className={`font-semibold ${avg >= 6.0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {avg.toFixed(1)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-300 text-xs">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center text-gray-600">
                                                    {s.total_absences ?? 0}
                                                </td>
                                                <td className="px-4 py-3 text-center text-gray-400 text-xs">
                                                    {s.folio_number ?? '—'}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                                                        {badge.text}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
