import { useState, useEffect, useRef } from 'react';
import api from '../../api/client';

/* Contador animado */
const AnimatedNumber = ({ value, duration = 900 }) => {
    const [display, setDisplay] = useState(0);
    const start = useRef(null);
    const num = parseFloat(value) || 0;
    useEffect(() => {
        start.current = null;
        const step = (ts) => {
            if (!start.current) start.current = ts;
            const p = Math.min((ts - start.current) / duration, 1);
            setDisplay(Math.round((1 - Math.pow(1 - p, 3)) * num));
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }, [num, duration]);
    return <>{display}</>;
};

/* Barra de progreso animada */
const Bar = ({ value, max, color }) => {
    const [w, setW] = useState(0);
    useEffect(() => { setTimeout(() => setW(max > 0 ? (value / max) * 100 : 0), 120); }, [value, max]);
    return (
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ease-out ${color}`} style={{ width: `${w}%` }} />
        </div>
    );
};

const DashboardStats = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => { loadDashboardStats(); }, []);

    const loadDashboardStats = async () => {
        try {
            setLoading(true);
            const r = await api.get('/dashboard/stats');
            if (r.data?.success) setStats(r.data.data);
            else setError('Respuesta inválida del servidor');
        } catch (err) {
            setError(err.response?.data?.message || 'Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="space-y-5 animate-fade-in">
            <div className="h-28 bg-gray-100 rounded-2xl animate-pulse" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}
            </div>
        </div>
    );

    if (error) return (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center animate-fade-up">
            <p className="text-red-600 text-sm">{error}</p>
            <button onClick={loadDashboardStats} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm btn-press">Reintentar</button>
        </div>
    );

    if (!stats) return null;

    const { cards, performanceStats, attendanceStats, alerts, academicYear, performanceByGrade } = stats;

    const maxAvg = performanceByGrade?.length
        ? Math.max(...performanceByGrade.map(g => parseFloat(g.avg_score) || 0), 0.1)
        : 10;

    return (
        <div className="space-y-5">

            {/* ── Banner superior ─────────────────────────────── */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 p-6 animate-fade-up">
                {/* Círculos decorativos sutiles */}
                <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/5" />
                <div className="absolute -right-2 top-8 h-20 w-20 rounded-full bg-white/5" />

                <div className="relative flex items-center justify-between">
                    <div>
                        <p className="text-blue-200 text-xs font-medium uppercase tracking-widest mb-1">Panel de control</p>
                        <h2 className="text-white text-2xl font-bold">Bienvenido, admin</h2>
                        <p className="text-blue-200/80 text-sm mt-1">Resumen académico actualizado</p>
                    </div>
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold backdrop-blur-sm ${
                        academicYear?.isActive ? 'bg-white/15 text-white' : 'bg-black/20 text-white/70'
                    }`}>
                        <span className={`h-2 w-2 rounded-full ${academicYear?.isActive ? 'bg-emerald-300 animate-pulse-soft' : 'bg-gray-400'}`} />
                        {academicYear?.name || 'Sin año activo'}
                    </div>
                </div>
            </div>

            {/* ── Tarjetas de métricas ─────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Estudiantes', value: cards?.students || 0, sub: `${cards?.activeEnrollments || 0} activos`, bg: 'bg-blue-700', light: 'bg-blue-50', text: 'text-blue-700', delay: 'delay-75',
                      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /> },
                    { label: 'Docentes', value: cards?.teachers || 0, sub: 'Activos', bg: 'bg-indigo-600', light: 'bg-indigo-50', text: 'text-indigo-600', delay: 'delay-150',
                      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /> },
                    { label: 'Asignaturas', value: cards?.subjects || 0, sub: 'Registradas', bg: 'bg-sky-600', light: 'bg-sky-50', text: 'text-sky-600', delay: 'delay-200',
                      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /> },
                    { label: 'Grados', value: cards?.grades || 0, sub: 'Grupos activos', bg: 'bg-violet-600', light: 'bg-violet-50', text: 'text-violet-600', delay: 'delay-300',
                      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M19 21v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" /> },
                ].map(c => (
                    <div key={c.label} className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 card-hover animate-fade-up ${c.delay}`}>
                        <div className={`inline-flex p-2 rounded-xl ${c.light} ${c.text} mb-3`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">{c.icon}</svg>
                        </div>
                        <p className="text-3xl font-bold text-gray-900">
                            <AnimatedNumber value={c.value} />
                        </p>
                        <div className="flex items-center justify-between mt-1">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{c.label}</p>
                            <p className={`text-xs font-medium ${c.text}`}>{c.sub}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Fila media ───────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Rendimiento — ocupa 2 columnas */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 animate-fade-up delay-200">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h3 className="text-sm font-bold text-gray-800">Rendimiento académico</h3>
                            <p className="text-xs text-gray-400 mt-0.5">Año lectivo {academicYear?.name}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-400 uppercase tracking-wide">Promedio general</p>
                            <p className="text-3xl font-bold text-gray-900 leading-none mt-0.5">
                                {performanceStats?.averageScore || '—'}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100 p-4 text-center">
                            <p className="text-4xl font-bold text-emerald-500">
                                <AnimatedNumber value={performanceStats?.highPerformance || 0} />
                            </p>
                            <p className="text-xs font-semibold text-emerald-600 mt-1">Alto / Superior</p>
                            <p className="text-xs text-gray-400 mt-0.5">Promedio ≥ 7.8</p>
                        </div>
                        <div className="rounded-xl bg-gradient-to-br from-red-50 to-rose-50 border border-red-100 p-4 text-center">
                            <p className="text-4xl font-bold text-red-400">
                                <AnimatedNumber value={performanceStats?.atRisk || 0} />
                            </p>
                            <p className="text-xs font-semibold text-red-500 mt-1">Desempeño Bajo</p>
                            <p className="text-xs text-gray-400 mt-0.5">Promedio &lt; 6.5</p>
                        </div>
                    </div>
                </div>

                {/* Faltas + alertas — 1 columna */}
                <div className="flex flex-col gap-4 animate-fade-up delay-300">

                    {/* Faltas */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex-1">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Asistencia</p>
                        <div className="flex items-end justify-between">
                            <div>
                                <p className="text-4xl font-bold text-gray-900">
                                    <AnimatedNumber value={attendanceStats?.totalAbsences || 0} />
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">faltas registradas</p>
                            </div>
                            <div className="text-right">
                                {attendanceStats?.studentMostAbsences && (<>
                                    <p className="text-xs text-gray-400">Mayor ausentismo</p>
                                    <p className="text-sm font-semibold text-gray-700">{attendanceStats.studentMostAbsences.full_name}</p>
                                    <p className="text-xs text-red-500 font-bold">{attendanceStats.studentMostAbsences.total_absences} faltas</p>
                                </>)}
                            </div>
                        </div>
                    </div>

                    {/* Alertas */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex-1">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Alertas</p>
                        {!alerts?.length ? (
                            <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full bg-emerald-50 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <p className="text-sm text-gray-400">Sin alertas activas</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {alerts.map((a, i) => (
                                    <div key={i} className={`p-2.5 rounded-xl text-xs border-l-4 ${
                                        a.type === 'danger'  ? 'bg-red-50 border-red-500' :
                                        a.severity === 'high' ? 'bg-red-50 border-red-400' :
                                        a.type === 'warning' ? 'bg-amber-50 border-amber-400' :
                                        'bg-blue-50 border-blue-400'
                                    }`}>
                                        <p className={`font-semibold ${
                                            a.type === 'danger' ? 'text-red-700' :
                                            a.severity === 'high' ? 'text-red-700' :
                                            a.type === 'warning' ? 'text-amber-700' :
                                            'text-blue-700'
                                        }`}>{a.title}</p>
                                        <p className="text-gray-600 mt-0.5">{a.message}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Gráfica de rendimiento por grado ────────────── */}
            {performanceByGrade?.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 animate-fade-up delay-400">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h3 className="text-sm font-bold text-gray-800">Rendimiento por grado</h3>
                            <p className="text-xs text-gray-400 mt-0.5">{performanceByGrade.length} grupos — promedio por grado</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-400" />Superior ≥9.0</span>
                            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" />Alto ≥7.8</span>
                            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" />Básico ≥6.5</span>
                            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-400" />Bajo &lt;6.5</span>
                        </div>
                    </div>

                    {/* Barras horizontales */}
                    <div className="space-y-3">
                        {performanceByGrade.map((g, i) => {
                            const avg = parseFloat(g.avg_score) || 0;
                            const barColor = avg >= 9.0 ? 'bg-gradient-to-r from-sky-400 to-sky-500'
                                           : avg >= 7.8 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                                           : avg >= 6.5 ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                                           : 'bg-gradient-to-r from-red-400 to-red-500';
                            const textColor = avg >= 9.0 ? 'text-sky-600'
                                           : avg >= 7.8 ? 'text-emerald-600'
                                           : avg >= 6.5 ? 'text-amber-600'
                                           : 'text-red-500';
                            return (
                                <div key={i} className="flex items-center gap-3">
                                    <span className="text-xs font-semibold text-gray-600 w-10 shrink-0">{g.grade_name}</span>
                                    <Bar value={avg} max={maxAvg} color={barColor} />
                                    <span className={`text-xs font-bold w-10 text-right shrink-0 ${textColor}`}>{avg.toFixed(2)}</span>
                                    <div className="flex gap-1 shrink-0">
                                        <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full">{g.high_performance || 0}</span>
                                        <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 bg-red-50 text-red-500 text-[10px] font-bold rounded-full">{g.at_risk || 0}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-400" />
                            <span className="text-xs text-gray-500">Mejor: <strong className="text-emerald-600">{performanceByGrade[0]?.grade_name}</strong> — {parseFloat(performanceByGrade[0]?.avg_score).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-red-400" />
                            <span className="text-xs text-gray-500">Mayor riesgo: <strong className="text-red-500">
                                {performanceByGrade.reduce((w, c) => (c.at_risk > (w?.at_risk || 0)) ? c : w, {})?.grade_name || 'N/A'}
                            </strong></span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardStats;
