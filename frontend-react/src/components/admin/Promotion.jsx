import { useState, useEffect, useCallback } from 'react';
import api from '../../api/client';

const STATUS_LABEL = {
    pending:   { text: 'Pendiente',  cls: 'bg-gray-100 text-gray-600' },
    promoted:  { text: 'Promovido',  cls: 'bg-green-100 text-green-700' },
    held_back: { text: 'Repite',     cls: 'bg-red-100 text-red-700' },
};

const PASS_AVERAGE = 6.0;

export default function Promotion() {
    const [years, setYears]           = useState([]);
    const [fromYearId, setFromYearId] = useState('');
    const [toYearId, setToYearId]     = useState('');
    const [students, setStudents]     = useState([]);
    const [loading, setLoading]       = useState(false);
    const [saving, setSaving]         = useState(false);
    const [executing, setExecuting]   = useState(false);
    const [result, setResult]         = useState(null);
    const [msg, setMsg]               = useState(null);
    const [tab, setTab]               = useState('classify'); // 'classify' | 'execute'
    const [filterGrade, setFilterGrade] = useState('');
    const [dirty, setDirty]           = useState(false);

    useEffect(() => {
        api.get('/academic-years').then(r => setYears(r.data?.data || r.data || [])).catch(() => {});
    }, []);

    const loadStudents = useCallback(async (yearId) => {
        if (!yearId) return;
        setLoading(true);
        setStudents([]);
        setResult(null);
        setMsg(null);
        try {
            const { data } = await api.get(`/promotions/${yearId}`);
            setStudents(data);
            setDirty(false);
        } catch {
            setMsg({ type: 'error', text: 'Error al cargar los estudiantes' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadStudents(fromYearId); }, [fromYearId, loadStudents]);

    // Cambiar estado de un estudiante localmente
    function setStatus(enrollmentId, status) {
        setStudents(prev => prev.map(s =>
            s.enrollment_id === enrollmentId ? { ...s, promotion_status: status } : s
        ));
        setDirty(true);
    }

    // Auto-clasificar todos según promedio
    function autoClassify() {
        setStudents(prev => prev.map(s => ({
            ...s,
            promotion_status: s.records_count > 0
                ? (parseFloat(s.final_average) >= PASS_AVERAGE ? 'promoted' : 'held_back')
                : 'pending',
        })));
        setDirty(true);
    }

    // Guardar estados en el backend
    async function saveStatus() {
        setSaving(true);
        setMsg(null);
        try {
            const updates = students.map(s => ({
                enrollmentId: s.enrollment_id,
                status: s.promotion_status,
            }));
            await api.put('/promotions/status', { updates });
            setMsg({ type: 'success', text: 'Estados guardados correctamente' });
            setDirty(false);
        } catch {
            setMsg({ type: 'error', text: 'Error al guardar los estados' });
        } finally {
            setSaving(false);
        }
    }

    // Ejecutar promoción masiva
    async function executePromotion() {
        if (!fromYearId || !toYearId) return;
        setExecuting(true);
        setResult(null);
        setMsg(null);
        try {
            const { data } = await api.post('/promotions/execute', { fromYearId, toYearId });
            setResult(data);
        } catch (err) {
            setMsg({ type: 'error', text: err.response?.data?.message || 'Error al ejecutar la promoción' });
        } finally {
            setExecuting(false);
        }
    }

    const getCourseDisplay = (s) =>
        s.grade_name + (s.group_name && s.group_name !== s.grade_name ? ` ${s.group_name}` : '');

    const grades = [...new Set(students.map(s => getCourseDisplay(s)))].sort();
    const filtered = filterGrade ? students.filter(s => getCourseDisplay(s) === filterGrade) : students;

    const counts = {
        promoted:  students.filter(s => s.promotion_status === 'promoted').length,
        held_back: students.filter(s => s.promotion_status === 'held_back').length,
        pending:   students.filter(s => s.promotion_status === 'pending').length,
    };

    const selectedYear = years.find(y => String(y.id) === String(fromYearId));
    const isYearActive = selectedYear?.active === 1;

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-lg font-bold text-gray-900">Promoción de estudiantes</h1>
                <p className="text-xs text-gray-500 mt-0.5">
                    Clasifica a los estudiantes como promovidos o repitentes y genera las matrículas del siguiente año automáticamente.
                </p>
            </div>

            {/* Selector de año origen */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">Año lectivo a evaluar</label>
                <select
                    value={fromYearId}
                    onChange={e => { setFromYearId(e.target.value); setFilterGrade(''); }}
                    className="w-full sm:w-72 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                    <option value="">Seleccionar año...</option>
                    {years.map(y => (
                        <option key={y.id} value={y.id}>
                            {y.name} {y.active ? '(activo)' : '(cerrado)'}
                        </option>
                    ))}
                </select>
                {fromYearId && isYearActive && (
                    <p className="text-xs text-amber-600 mt-1.5">
                        Este año sigue activo. Puedes clasificar los estudiantes pero la promoción debe ejecutarse después de cerrarlo.
                    </p>
                )}
            </div>

            {/* Tabs */}
            {fromYearId && (
                <div className="flex gap-1 border-b border-gray-200">
                    {[
                        { id: 'classify', label: 'Clasificar estudiantes' },
                        { id: 'execute',  label: 'Ejecutar promoción' },
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                tab === t.id
                                    ? 'border-blue-600 text-blue-700'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            )}

            {/* ── TAB: CLASIFICAR ── */}
            {tab === 'classify' && fromYearId && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    {/* Header con controles */}
                    <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap gap-3 items-center justify-between">
                        <div className="flex gap-4 text-sm">
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
                                <span className="text-gray-600">Promovidos: <strong>{counts.promoted}</strong></span>
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
                                <span className="text-gray-600">Repiten: <strong>{counts.held_back}</strong></span>
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-300" />
                                <span className="text-gray-600">Pendientes: <strong>{counts.pending}</strong></span>
                            </span>
                        </div>
                        <div className="flex gap-2 items-center flex-wrap">
                            {grades.length > 1 && (
                                <select
                                    value={filterGrade}
                                    onChange={e => setFilterGrade(e.target.value)}
                                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                                >
                                    <option value="">Todos los grados</option>
                                    {grades.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            )}
                            <button
                                onClick={autoClassify}
                                className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                            >
                                Auto-clasificar (≥{PASS_AVERAGE})
                            </button>
                            <button
                                onClick={saveStatus}
                                disabled={saving || !dirty}
                                className="px-3 py-1.5 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-40 transition-colors"
                            >
                                {saving ? 'Guardando...' : 'Guardar estados'}
                            </button>
                        </div>
                    </div>

                    {/* Mensaje */}
                    {msg && (
                        <div className={`mx-5 mt-4 px-4 py-2.5 rounded-lg text-sm ${
                            msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                        }`}>{msg.text}</div>
                    )}

                    {/* Tabla */}
                    {loading ? (
                        <div className="py-12 text-center text-sm text-gray-400">Cargando estudiantes...</div>
                    ) : filtered.length === 0 ? (
                        <div className="py-12 text-center text-sm text-gray-400">
                            {fromYearId ? 'No hay estudiantes para este año' : 'Selecciona un año'}
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
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filtered.map(s => {
                                        const avg = parseFloat(s.final_average);
                                        const passes = !isNaN(avg) && avg >= PASS_AVERAGE;
                                        return (
                                            <tr key={s.enrollment_id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-5 py-3">
                                                    <div className="font-medium text-gray-900 text-sm">{s.full_name}</div>
                                                    <div className="text-xs text-gray-400">{s.student_code}</div>
                                                </td>
                                                <td className="px-4 py-3 text-gray-600 text-sm">
                                                    {s.grade_name}{s.group_name && s.group_name !== s.grade_name ? ` ${s.group_name}` : ''}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {s.records_count > 0 ? (
                                                        <span className={`font-semibold text-sm ${passes ? 'text-green-600' : 'text-red-600'}`}>
                                                            {avg.toFixed(1)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-300 text-xs">Sin notas</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center text-sm text-gray-600">
                                                    {s.total_absences ?? 0}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <select
                                                        value={s.promotion_status}
                                                        onChange={e => setStatus(s.enrollment_id, e.target.value)}
                                                        className={`text-xs font-medium rounded-full px-2 py-1 border-0 outline-none cursor-pointer ${STATUS_LABEL[s.promotion_status]?.cls}`}
                                                    >
                                                        <option value="pending">Pendiente</option>
                                                        <option value="promoted">Promovido</option>
                                                        <option value="held_back">Repite</option>
                                                    </select>
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

            {/* ── TAB: EJECUTAR ── */}
            {tab === 'execute' && fromYearId && (
                <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
                    <div>
                        <h2 className="text-sm font-semibold text-gray-800 mb-1">Ejecutar promoción masiva</h2>
                        <p className="text-xs text-gray-500">
                            Crea automáticamente las matrículas del año destino. Los promovidos pasan al siguiente grado,
                            los repitentes quedan en el mismo grado. Esta acción no borra nada del año anterior.
                        </p>
                    </div>

                    {/* Resumen antes de ejecutar */}
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { label: 'Serán promovidos', count: counts.promoted, color: 'green' },
                            { label: 'Repetirán grado',  count: counts.held_back, color: 'red' },
                            { label: 'Sin clasificar',   count: counts.pending,   color: 'gray' },
                        ].map(item => (
                            <div key={item.label} className={`bg-${item.color}-50 border border-${item.color}-100 rounded-xl p-4 text-center`}>
                                <div className={`text-2xl font-bold text-${item.color}-700`}>{item.count}</div>
                                <div className="text-xs text-gray-500 mt-1">{item.label}</div>
                            </div>
                        ))}
                    </div>

                    {counts.pending > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700">
                            Hay {counts.pending} estudiante(s) sin clasificar. Ve a la pestaña "Clasificar estudiantes" para definir su estado antes de ejecutar.
                        </div>
                    )}

                    {/* Selector año destino */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Año lectivo destino</label>
                        <select
                            value={toYearId}
                            onChange={e => { setToYearId(e.target.value); setResult(null); }}
                            className="w-full sm:w-72 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            <option value="">Seleccionar año destino...</option>
                            {years
                                .filter(y => String(y.id) !== String(fromYearId))
                                .map(y => (
                                    <option key={y.id} value={y.id}>
                                        {y.name} {y.active ? '(activo)' : ''}
                                    </option>
                                ))
                            }
                        </select>
                    </div>

                    {/* Mensaje / resultado */}
                    {msg && (
                        <div className={`px-4 py-3 rounded-lg text-sm ${
                            msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                        }`}>{msg.text}</div>
                    )}

                    {result && (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
                            <p className="text-sm font-semibold text-green-800">{result.message}</p>
                            <div className="flex gap-6 text-sm text-green-700">
                                <span>Promovidos matriculados: <strong>{result.promoted}</strong></span>
                                <span>Repitentes matriculados: <strong>{result.heldBack}</strong></span>
                                {result.skipped > 0 && <span className="text-amber-700">Omitidos: <strong>{result.skipped}</strong></span>}
                            </div>
                            {result.warnings?.length > 0 && (
                                <details className="text-xs text-amber-700 mt-1">
                                    <summary className="cursor-pointer">Ver advertencias ({result.warnings.length})</summary>
                                    <ul className="mt-1 space-y-0.5 list-disc list-inside">
                                        {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                                    </ul>
                                </details>
                            )}
                        </div>
                    )}

                    <button
                        onClick={executePromotion}
                        disabled={executing || !toYearId || counts.promoted + counts.held_back === 0}
                        className="px-5 py-2.5 bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-800 disabled:opacity-40 transition-colors"
                    >
                        {executing ? 'Ejecutando...' : 'Ejecutar promoción'}
                    </button>
                </div>
            )}
        </div>
    );
}
