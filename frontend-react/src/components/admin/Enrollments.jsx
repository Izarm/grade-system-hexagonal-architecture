import { useState, useEffect } from 'react';
import api from '../../api/client';
import ConfirmDialog from '../common/ConfirmDialog';
import { useActiveAcademicYear } from '../../hooks/useActiveAcademicYear';
import { useRefresh } from '../../contexts/RefreshContext';
import { STUDENT_DOCS } from '../../constants/documents';


// Descarga la Tarjeta Acumulativa de Matrícula (Word) de un estudiante.
// Vive fuera de los componentes porque se usa desde dos lugares: el botón de
// cada fila del listado y el pie del historial.
const descargarTarjetaMatricula = async (studentCode) => {
    const token = localStorage.getItem('token');
    const res = await fetch(
        `${api.defaults.baseURL}/reports/enrollment-card-word?studentCode=${encodeURIComponent(studentCode)}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
        // El backend responde JSON cuando falla; si no, se usa un texto genérico.
        let detalle = 'No se pudo generar la tarjeta de matrícula';
        try {
            const cuerpo = await res.json();
            if (cuerpo?.message) detalle = cuerpo.message;
        } catch { /* la respuesta no era JSON */ }
        throw new Error(detalle);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', `Tarjeta_Matricula_${studentCode}.docx`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
};

// ── Historial de matrículas ───────────────────────────────────────────────────
const StudentHistoryModal = ({ student, onClose }) => {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        api.get(`/enrollments/history/student/${encodeURIComponent(student.student_code)}`)
            .then(r => setRecords(r.data))
            .catch(() => setRecords([]))
            .finally(() => setLoading(false));
    }, [student.student_code]);

    const downloadCard = async () => {
        setDownloading(true);
        try {
            await descargarTarjetaMatricula(student.student_code);
        } catch (e) {
            alert(e.message);
        } finally {
            setDownloading(false);
        }
    };

    return (
        // La tarjeta se limita a 85% de la altura de pantalla y el historial
        // lleva su propio scroll. Antes, con muchas matriculas, la tarjeta
        // crecia mas que la ventana y el pie (con el boton de la tarjeta de
        // matricula) quedaba fuera de la vista, sin forma de alcanzarlo.
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                    <div>
                        <h3 className="text-[15px] font-semibold text-gray-800">{student.student_name}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Código: {student.student_code} · {records.length} matrícula{records.length !== 1 ? 's' : ''} registrada{records.length !== 1 ? 's' : ''}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="p-6 overflow-y-auto flex-1 min-h-0">
                    {loading ? (
                        <p className="text-center text-gray-400 text-sm py-6">Cargando historial...</p>
                    ) : records.length === 0 ? (
                        <p className="text-center text-gray-400 text-sm py-6">Sin registros</p>
                    ) : (
                        <div className="space-y-2">
                            {records.map((r, i) => (
                                <div key={i} className="flex items-center justify-between px-4 py-3 rounded-lg bg-gray-50 border border-gray-100">
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm font-bold text-blue-700 w-10">{r.academic_year}</span>
                                        <span className="text-sm text-gray-700">{r.grade_name}{r.group_name ? ` ${r.group_name}` : ''}</span>
                                    </div>
                                    <span className="text-sm text-gray-500">
                                        {r.enrollment_value ? `$${Number(r.enrollment_value).toLocaleString('es-CO')}` : '-'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
                    <button onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                        Cerrar
                    </button>
                    <button onClick={downloadCard} disabled={downloading || loading}
                        className="px-4 py-2 text-sm bg-blue-700 hover:bg-blue-800 text-white rounded-lg transition disabled:opacity-50 font-medium inline-flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        {downloading ? 'Generando...' : 'Tarjeta de matrícula'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Matrículas por año (unifica el listado del año activo y el histórico) ───────
const EnrollmentsByYear = ({ refreshKey, onTransfer, onDelete }) => {
    const [years, setYears] = useState([]);
    const [year, setYear] = useState('');
    const [editable, setEditable] = useState(false);
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState(null);
    // Código del estudiante cuya tarjeta se está generando, para deshabilitar
    // solo ese botón y no toda la tabla.
    const [generandoTarjeta, setGenerandoTarjeta] = useState(null);

    const bajarTarjeta = async (studentCode) => {
        setGenerandoTarjeta(studentCode);
        try {
            await descargarTarjetaMatricula(studentCode);
        } catch (e) {
            alert(e.message);
        } finally {
            setGenerandoTarjeta(null);
        }
    };
    const PER_PAGE = 20;

    const norm = (x) => x?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') || '';

    // Años disponibles (activo + histórico)
    useEffect(() => {
        (async () => {
            try {
                const res = await api.get('/enrollments/years');
                const list = Array.isArray(res.data) ? res.data : [];
                setYears(list);
                if (!year && list.length) {
                    setYear(String((list.find(y => y.active) || list[0]).year));
                }
            } catch { setYears([]); }
        })();
    }, [refreshKey]);

    // Filas del año seleccionado
    const loadRows = async (y = year) => {
        if (!y) return;
        setLoading(true);
        try {
            const res = await api.get(`/enrollments/by-year?year=${encodeURIComponent(y)}`);
            setRows(res.data?.rows || []);
            setEditable(!!res.data?.editable);
            setPage(1);
        } catch { setRows([]); setEditable(false); }
        finally { setLoading(false); }
    };
    useEffect(() => { loadRows(year); }, [year, refreshKey]);

    const filtered = rows.filter(r =>
        norm(r.student_name).includes(norm(search)) || (r.student_code || '').includes(search));
    const totalPages = Math.ceil(filtered.length / PER_PAGE);
    const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
    useEffect(() => { setPage(1); }, [search]);
    const goToPage = (p) => { if (p >= 1 && p <= totalPages) setPage(p); };

    const yearInfo = years.find(y => String(y.year) === String(year));

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 card-hover overflow-hidden">
            {selected && <StudentHistoryModal student={selected} onClose={() => setSelected(null)} />}

            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-wrap justify-between items-center gap-3">
                <div>
                    <h2 className="text-[15px] font-semibold text-gray-800">Matrículas</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                        {editable
                            ? 'Año lectivo activo · puedes trasladar o eliminar matrículas'
                            : 'Año anterior · solo consulta'}
                        {' · clic en el estudiante para ver todo su historial'}
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <select value={year} onChange={e => setYear(e.target.value)}
                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none">
                        {years.map(y => (
                            <option key={y.year} value={y.year}>
                                {y.year}{y.active ? ' (activo)' : ''} · {y.total}
                            </option>
                        ))}
                    </select>
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por nombre o código..."
                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none w-56" />
                    <span className="text-xs text-gray-400">
                        {filtered.length} matrícula{filtered.length !== 1 ? 's' : ''}
                    </span>
                    <button onClick={() => loadRows(year)} className="text-gray-500 hover:text-gray-700 text-sm transition">
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
                            <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                            <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400 text-sm">Cargando...</td></tr>
                        ) : paginated.length === 0 ? (
                            <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400 text-sm">No hay matrículas para este año</td></tr>
                        ) : (
                            paginated.map((e, i) => (
                                <tr key={e.enrollment_id || `${e.student_code}-${i}`} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-5 py-3 text-center font-bold text-gray-700">{e.folio_number || '-'}</td>
                                    <td className="px-5 py-3 font-medium text-gray-800">
                                        {e.grade_name ? `${e.grade_name}${e.group_name ? ' ' + e.group_name : ''}` : '-'}
                                    </td>
                                    <td className="px-5 py-3">
                                        <button onClick={() => setSelected({ student_code: e.student_code, student_name: e.student_name })}
                                            className="text-gray-700 hover:text-blue-700 hover:underline text-left transition">
                                            {e.student_name || '-'}
                                        </button>
                                    </td>
                                    <td className="px-5 py-3 text-gray-500">{e.student_code || '-'}</td>
                                    <td className="px-5 py-3 text-gray-500">
                                        {e.enrollment_value ? `$${Number(e.enrollment_value).toLocaleString('es-CO')}` : '-'}
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-3">
                                            {/* La tarjeta es acumulativa, asi que se ofrece tambien en
                                                los años cerrados, donde no se puede trasladar ni eliminar. */}
                                            <button onClick={() => bajarTarjeta(e.student_code)}
                                                disabled={generandoTarjeta !== null}
                                                title="Descargar la tarjeta de matrícula en Word"
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50 text-xs font-medium transition disabled:opacity-50">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                </svg>
                                                {generandoTarjeta === e.student_code ? 'Generando...' : 'Tarjeta'}
                                            </button>
                                            {editable && (
                                                <>
                                                    <button
                                                        onClick={() => onTransfer({
                                                            id: e.enrollment_id, student_name: e.student_name,
                                                            grade_name: e.grade_name, group_letter: e.group_name,
                                                            group_name: e.group_name, group_id: e.group_id,
                                                        })}
                                                        className="text-blue-500 hover:text-blue-700 text-sm font-medium transition">
                                                        Trasladar
                                                    </button>
                                                    <button onClick={() => onDelete(e.enrollment_id)}
                                                        className="text-red-400 hover:text-red-500 text-sm font-medium transition">
                                                        Eliminar
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (() => {
                const WINDOW = 5;
                const half = Math.floor(WINDOW / 2);
                let start = Math.max(1, page - half);
                let end   = Math.min(totalPages, start + WINDOW - 1);
                if (end - start < WINDOW - 1) start = Math.max(1, end - WINDOW + 1);
                const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
                return (
                    <div className="flex justify-center items-center gap-1 py-4 border-t border-gray-100 bg-gray-50/50 flex-wrap">
                        <button onClick={() => goToPage(1)} disabled={page === 1}
                            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 transition">«</button>
                        <button onClick={() => goToPage(page - 1)} disabled={page === 1}
                            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 transition">Anterior</button>
                        {start > 1 && <span className="px-1 text-xs text-gray-400">…</span>}
                        {pages.map(p => (
                            <button key={p} onClick={() => goToPage(p)}
                                className={`w-7 h-7 text-xs rounded-md transition ${page === p ? 'bg-blue-700 text-white font-semibold' : 'text-gray-600 hover:bg-gray-100'}`}>
                                {p}
                            </button>
                        ))}
                        {end < totalPages && <span className="px-1 text-xs text-gray-400">…</span>}
                        <button onClick={() => goToPage(page + 1)} disabled={page === totalPages}
                            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 transition">Siguiente</button>
                        <button onClick={() => goToPage(totalPages)} disabled={page === totalPages}
                            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 transition">»</button>
                    </div>
                );
            })()}
        </div>
    );
};

// ── Matrícula del año nuevo (parte de los estudiantes del año anterior) ─────────
// DESCONECTADO. La pestaña "Matricular año nuevo" se retiró de la interfaz a
// petición del colegio. El componente se conserva —igual que sus rutas en el
// servidor, /enrollments/new-year-candidates y /enrollments/bulk— por si más
// adelante se quiere recuperar la matrícula en lote. Para volver a activarlo
// basta con reponer su entrada en la lista de pestañas y el bloque que lo
// dibuja, ambos junto a 'unenrolled' más abajo.
const NewYearEnrollment = ({ activeYear, refreshKey, onDone }) => {
    const [info, setInfo] = useState({ fromYearId: null, fromYearName: null, students: [], targetGroups: [] });
    const [loading, setLoading] = useState(true);
    const [assign, setAssign] = useState({});
    const [selected, setSelected] = useState({});
    const [search, setSearch] = useState('');
    const [filterGrade, setFilterGrade] = useState('');
    const [saving, setSaving] = useState(false);
    const [cloning, setCloning] = useState(false);
    const [msg, setMsg] = useState(null);
    const [page, setPage] = useState(1);
    const PER_PAGE = 20;

    const norm = (x) => x?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') || '';
    const notify = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 4000); };

    const load = async () => {
        if (!activeYear) return;
        setLoading(true);
        try {
            const res = await api.get(`/enrollments/new-year-candidates?toYearId=${activeYear.id}`);
            const d = res.data || {};
            setInfo(d);
            const a = {};
            (d.students || []).forEach(s => { if (s.suggested_group_id) a[s.student_id] = String(s.suggested_group_id); });
            setAssign(a);
            setSelected({});
            setPage(1);
        } catch {
            setInfo({ fromYearId: null, fromYearName: null, students: [], targetGroups: [] });
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [activeYear?.id, refreshKey]);

    const cloneStructure = async () => {
        if (!info.fromYearId) return;
        setCloning(true);
        try {
            const res = await api.post(`/academic-years/${activeYear.id}/clone-structure`, { fromYearId: info.fromYearId });
            notify('success', res.data?.message || 'Estructura copiada');
            await load();
        } catch (err) {
            notify('error', err.response?.data?.message || 'No se pudo copiar la estructura');
        } finally { setCloning(false); }
    };

    const grades = [...new Set(info.students.map(s => s.prev_grade_name))];
    const filtered = info.students.filter(s =>
        (norm(s.full_name).includes(norm(search)) || (s.student_code || '').includes(search)) &&
        (!filterGrade || s.prev_grade_name === filterGrade));

    const totalPages = Math.ceil(filtered.length / PER_PAGE);
    const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
    useEffect(() => { setPage(1); }, [search, filterGrade]);

    const selectedIds = Object.keys(selected).filter(k => selected[k]);
    const readyCount = selectedIds.filter(id => assign[id]).length;

    const toggleAllVisible = (on) => {
        const next = { ...selected };
        paginated.forEach(s => { next[s.student_id] = on; });
        setSelected(next);
    };

    const submit = async () => {
        const items = selectedIds
            .filter(id => assign[id])
            .map(id => ({ studentId: parseInt(id), groupId: parseInt(assign[id]) }));
        if (items.length === 0) { notify('error', 'Selecciona estudiantes y asígnales un curso'); return; }
        setSaving(true);
        try {
            const res = await api.post('/enrollments/bulk', { academicYearId: activeYear.id, items });
            notify('success', `${res.data.created} matriculado(s)${res.data.skipped ? `, ${res.data.skipped} omitido(s)` : ''}`);
            await load();
            onDone?.();
        } catch (err) {
            notify('error', err.response?.data?.message || 'Error al matricular');
        } finally { setSaving(false); }
    };

    if (loading) return (
        <div className="flex justify-center items-center py-16">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-gray-400 text-sm">Cargando...</span>
        </div>
    );

    if (!info.fromYearId) return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <p className="text-sm text-gray-500">No hay un año lectivo anterior con matrículas desde el cual traer estudiantes.</p>
        </div>
    );

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 card-hover overflow-hidden">
            {msg && (
                <div className={`fixed top-5 right-5 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm ${msg.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                    {msg.text}
                </div>
            )}

            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <h2 className="text-[15px] font-semibold text-gray-800">Matricular al año {activeYear?.name}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                    Estudiantes de <strong>{info.fromYearName}</strong> que aún no tienen matrícula en {activeYear?.name}.
                    Se sugiere el grado siguiente; puedes cambiarlo antes de matricular.
                </p>
            </div>

            {info.targetGroups.length === 0 ? (
                <div className="p-8 text-center space-y-3">
                    <p className="text-sm text-gray-600">
                        El año {activeYear?.name} todavía no tiene grados ni cursos creados, así que no hay dónde matricular.
                    </p>
                    <button onClick={cloneStructure} disabled={cloning}
                        className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50">
                        {cloning ? 'Copiando...' : `Copiar grados y cursos de ${info.fromYearName}`}
                    </button>
                    <p className="text-xs text-gray-400">También puedes crearlos manualmente en la sección Grados.</p>
                </div>
            ) : (
                <>
                    <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar por nombre o código..."
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none w-full sm:w-56" />
                        <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none">
                            <option value="">Todos los grados</option>
                            {grades.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <span className="text-xs text-gray-400">{filtered.length} pendiente(s)</span>
                        <button onClick={submit} disabled={saving || readyCount === 0}
                            className="ml-auto bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50">
                            {saving ? 'Matriculando...' : `Matricular seleccionados (${readyCount})`}
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-4 py-3 w-10">
                                        <input type="checkbox"
                                            checked={paginated.length > 0 && paginated.every(s => selected[s.student_id])}
                                            onChange={e => toggleAllVisible(e.target.checked)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                    </th>
                                    {['Estudiante', 'Código', `Grado en ${info.fromYearName}`, `Matricular en ${activeYear?.name}`].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {paginated.map(s => (
                                    <tr key={s.student_id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-4 py-2.5">
                                            <input type="checkbox"
                                                checked={!!selected[s.student_id]}
                                                onChange={e => setSelected({ ...selected, [s.student_id]: e.target.checked })}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                        </td>
                                        <td className="px-4 py-2.5 font-medium text-gray-800">{s.full_name}</td>
                                        <td className="px-4 py-2.5 text-gray-500">{s.student_code}</td>
                                        <td className="px-4 py-2.5">
                                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                                                {s.prev_grade_name} {s.prev_group_name}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <select
                                                value={assign[s.student_id] || ''}
                                                onChange={e => setAssign({ ...assign, [s.student_id]: e.target.value })}
                                                className={`px-2 py-1.5 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 ${assign[s.student_id] ? 'border-gray-200' : 'border-amber-300 bg-amber-50'}`}
                                            >
                                                <option value="">Sin asignar</option>
                                                {info.targetGroups.map(g => (
                                                    <option key={g.id} value={g.id}>{g.grade_name} {g.group_name}</option>
                                                ))}
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-1 py-4 border-t border-gray-100 flex-wrap">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 transition">Anterior</button>
                            <span className="text-xs text-gray-500 px-2">Página {page} de {totalPages}</span>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 transition">Siguiente</button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

// ── Egresados / No matriculados en el año activo ────────────────────────────────
const UnenrolledStudents = ({ activeYear, refreshKey, onEnroll }) => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState(null);
    const [history, setHistory] = useState({});
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    const norm = (x) => x?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') || '';

    const load = async () => {
        if (!activeYear) return;
        setLoading(true);
        try {
            const res = await api.get(`/enrollments/unenrolled?academicYearId=${activeYear.id}`);
            setRows(Array.isArray(res.data) ? res.data : []);
        } catch { setRows([]); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [activeYear?.id, refreshKey]);

    const toggle = async (s) => {
        if (expanded === s.id) { setExpanded(null); return; }
        setExpanded(s.id);
        if (!history[s.student_code]) {
            try {
                const res = await api.get(`/enrollments/history/student/${encodeURIComponent(s.student_code)}`);
                setHistory(h => ({ ...h, [s.student_code]: Array.isArray(res.data) ? res.data : [] }));
            } catch { setHistory(h => ({ ...h, [s.student_code]: [] })); }
        }
    };

    const filtered = rows.filter(r =>
        norm(r.full_name).includes(norm(search)) || (r.student_code || '').includes(search));

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const goToPage = (p) => { if (p >= 1 && p <= totalPages) setCurrentPage(p); };
    useEffect(() => { setCurrentPage(1); }, [search]);

    if (loading) return (
        <div className="flex justify-center items-center py-16">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-gray-400 text-sm">Cargando...</span>
        </div>
    );

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 card-hover overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-wrap justify-between items-center gap-3">
                <div>
                    <h2 className="text-[15px] font-semibold text-gray-800">Egresados / No matriculados</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Estudiantes sin matrícula en {activeYear?.name}. Solo lectura; usa “Matricular” para reincorporarlos.</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                        {filtered.length} estudiante{filtered.length !== 1 ? 's' : ''}
                    </span>
                    <input
                        type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por nombre o código..."
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none w-full sm:w-64"
                    />
                </div>
            </div>

            {filtered.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-10">No hay estudiantes sin matrícula</p>
            ) : (
                <div className="divide-y divide-gray-50">
                    {paginated.map(s => {
                        const isOpen = expanded === s.id;
                        const hist = history[s.student_code];
                        return (
                            <div key={s.id}>
                                <div className="flex items-center justify-between px-6 py-3 hover:bg-gray-50/60 transition-colors">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate">{s.full_name}</p>
                                        <p className="text-xs text-gray-400">
                                            {s.student_code}
                                            {s.last_grade ? ` · Último: ${s.last_grade}${s.last_year ? ' (' + s.last_year + ')' : ''}` : ' · Sin matrículas previas'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="hidden sm:inline text-xs text-gray-400">
                                            {s.enrollment_count} matrícula{s.enrollment_count !== 1 ? 's' : ''}
                                        </span>
                                        <button onClick={() => toggle(s)}
                                            className="text-gray-500 hover:text-gray-700 text-xs font-medium px-2 py-1 rounded-lg hover:bg-gray-100 transition">
                                            {isOpen ? 'Ocultar' : 'Historial'}
                                        </button>
                                        <button onClick={() => onEnroll(s)}
                                            className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition">
                                            Matricular
                                        </button>
                                    </div>
                                </div>
                                {isOpen && (
                                    <div className="px-6 pb-4 bg-gray-50/40">
                                        {!hist ? (
                                            <p className="text-xs text-gray-400 py-2">Cargando historial...</p>
                                        ) : hist.length === 0 ? (
                                            <p className="text-xs text-gray-400 py-2">Sin historial de matrículas registrado.</p>
                                        ) : (
                                            <table className="w-full text-xs mt-1">
                                                <thead>
                                                    <tr className="text-gray-400 text-left">
                                                        <th className="py-1 pr-3 font-medium">Año</th>
                                                        <th className="py-1 pr-3 font-medium">Grado</th>
                                                        <th className="py-1 pr-3 font-medium">Grupo</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="text-gray-600">
                                                    {hist.map((h, i) => (
                                                        <tr key={i} className="border-t border-gray-100">
                                                            <td className="py-1 pr-3">{h.academic_year}</td>
                                                            <td className="py-1 pr-3">{h.grade_name}</td>
                                                            <td className="py-1 pr-3">{h.group_name}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {totalPages > 1 && (() => {
                const WINDOW = 5;
                const half = Math.floor(WINDOW / 2);
                let start = Math.max(1, currentPage - half);
                let end   = Math.min(totalPages, start + WINDOW - 1);
                if (end - start < WINDOW - 1) start = Math.max(1, end - WINDOW + 1);
                const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
                return (
                    <div className="flex justify-center items-center gap-1 py-4 border-t border-gray-100 flex-wrap">
                        <button onClick={() => goToPage(1)} disabled={currentPage === 1}
                            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition">«</button>
                        <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}
                            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition">Anterior</button>
                        {start > 1 && <span className="px-1 text-xs text-gray-400">…</span>}
                        {pages.map(page => (
                            <button key={page} onClick={() => goToPage(page)}
                                className={`w-7 h-7 text-xs rounded-md transition ${currentPage === page ? 'bg-blue-700 text-white font-semibold' : 'text-gray-600 hover:bg-gray-100'}`}>
                                {page}
                            </button>
                        ))}
                        {end < totalPages && <span className="px-1 text-xs text-gray-400">…</span>}
                        <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}
                            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition">Siguiente</button>
                        <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages}
                            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition">»</button>
                    </div>
                );
            })()}
        </div>
    );
};

const Enrollments = () => {
    const { refreshKey, refresh } = useRefresh();
    const [enrollments, setEnrollments] = useState([]);
    const [students, setStudents] = useState([]);
    const [groups, setGroups] = useState([]);
    const [form, setForm] = useState({ studentId: '', groupId: '', enrollmentValue: '' });
    // Ficha completa del estudiante seleccionado + datos complementarios editables
    const [studentDetail, setStudentDetail] = useState(null);
    const [showComp, setShowComp] = useState(false);
    const EMPTY_COMP = {
        phone_landline: '', phone_mobile1: '', phone_mobile2: '',
        email_father: '', email_mother: '', address: '',
        withdrawal_date: '', withdrawal_reason: '', observations: '',
    };
    const [compForm, setCompForm] = useState(EMPTY_COMP);
    const [compDocs, setCompDocs] = useState([]); // documentos entregados (códigos)
    const toggleDoc = (code) => setCompDocs(prev =>
        prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [enrollmentToDelete, setEnrollmentToDelete] = useState(null);
    const [activeTab, setActiveTab] = useState('create');

    const [showTransferModal, setShowTransferModal] = useState(false);
    const [enrollmentToTransfer, setEnrollmentToTransfer] = useState(null);
    const [transferGroupId, setTransferGroupId] = useState('');
    const [transferLoading, setTransferLoading] = useState(false);

    const [studentSearch, setStudentSearch] = useState('');
    const [showStudentDropdown, setShowStudentDropdown] = useState(false);
    const [listSearch, setListSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(20);

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
        if (!activeYear) return;
        try {
            const res = await api.get(`/enrollments?academicYearId=${activeYear.id}`);
            const data = extractData(res.data);
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
        if (!activeYear) return;
        try {
            const groupsRes = await api.get(`/groups?academicYearId=${activeYear.id}`);
            const groupsData = extractData(groupsRes.data);

            const groupsWithFullName = groupsData.map(g => ({
                id: g.id,
                grade_id: g.grade_id,
                name: g.name,
                grade_name: g.grade_name,
                full_name: g.name && g.name !== g.grade_name
                    ? `${g.grade_name} ${g.name}`
                    : g.grade_name || g.name
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
        if (activeYear) {
            loadEnrollments();
            loadGroupsList();
        }
        loadStudentsList();
    }, [refreshKey, activeYear?.id]);

    // Al seleccionar un estudiante, cargar su ficha completa y precargar los
    // datos complementarios (para poder actualizarlos al matricular).
    useEffect(() => {
        if (!form.studentId) {
            setStudentDetail(null);
            setCompForm(EMPTY_COMP);
            setCompDocs([]);
            setShowComp(false);
            return;
        }
        let cancel = false;
        (async () => {
            try {
                const res = await api.get(`/students/${form.studentId}`);
                const s = res.data?.data || res.data;
                if (cancel || !s) return;
                setStudentDetail(s);
                const toInput = (d) => (d ? String(d).slice(0, 10) : '');
                setCompForm({
                    phone_landline:   s.phone_landline   || '',
                    phone_mobile1:    s.phone_mobile1    || '',
                    phone_mobile2:    s.phone_mobile2    || '',
                    email_father:     s.email_father     || '',
                    email_mother:     s.email_mother     || '',
                    address:          s.address          || '',
                    withdrawal_date:  toInput(s.withdrawal_date),
                    withdrawal_reason: s.withdrawal_reason || '',
                    observations:     s.observations     || '',
                });
                setCompDocs(Array.isArray(s.documents) ? s.documents : []);
            } catch {
                if (!cancel) { setStudentDetail(null); setCompForm(EMPTY_COMP); setCompDocs([]); }
            }
        })();
        return () => { cancel = true; };
    }, [form.studentId]);

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
            // 1) Guardar los datos complementarios actualizados (ficha completa,
            //    para no borrar los campos que no se editan aquí).
            if (studentDetail) {
                // Las fechas llegan como ISO con hora/zona; MySQL (columna DATE)
                // solo acepta YYYY-MM-DD, así que las recortamos.
                const toDate = (d) => (d ? String(d).slice(0, 10) : null);
                await api.put(`/students/${form.studentId}`, {
                    ...studentDetail,
                    birth_date:       toDate(studentDetail.birth_date),
                    admission_date:   toDate(studentDetail.admission_date),
                    phone_landline:   compForm.phone_landline || null,
                    phone_mobile1:    compForm.phone_mobile1 || null,
                    phone_mobile2:    compForm.phone_mobile2 || null,
                    email_father:     compForm.email_father || null,
                    email_mother:     compForm.email_mother || null,
                    address:          compForm.address || null,
                    withdrawal_date:  compForm.withdrawal_date || null,
                    withdrawal_reason: compForm.withdrawal_reason || null,
                    observations:     compForm.observations || null,
                    documents:        compDocs,
                });
            }

            // 2) Crear la matrícula.
            const payload = {
                studentId: parseInt(form.studentId),
                groupId: parseInt(form.groupId),
                academicYearId: activeYear.id,
                enrollmentValue: form.enrollmentValue ? parseInt(form.enrollmentValue) : null
            };
            await api.post('/enrollments', payload);
            setMessage({ type: 'success', text: 'Matrícula creada y datos actualizados' });
            setForm({ studentId: '', groupId: '', enrollmentValue: '' });
            setStudentSearch('');
            setStudentDetail(null);
            setCompForm(EMPTY_COMP);
            setCompDocs([]);
            setShowComp(false);
            refresh();
        } catch (err) {
            console.error('Error:', err);
            setMessage({ type: 'error', text: err.response?.data?.message || 'Error al crear matrícula' });
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    // Reincorporar un egresado/no matriculado: preselecciona la ficha existente
    // y lleva al formulario de matrícula (no crea un estudiante nuevo).
    const handleEnrollExisting = (student) => {
        setForm({ studentId: student.id, groupId: '', enrollmentValue: '' });
        setStudentSearch(`${student.full_name} - ${student.student_code}`);
        setShowComp(true);
        setActiveTab('create');
        setMessage({ type: 'success', text: `${student.full_name} listo para matricular — revisa sus datos, elige el curso y guarda` });
        setTimeout(() => setMessage(null), 4000);
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
            } finally {
                setTimeout(() => setMessage(null), 3000);
            }
        }
        setShowConfirm(false);
        setEnrollmentToDelete(null);
    };

    const cancelDelete = () => setShowConfirm(false);

    const handleTransferClick = (enrollment) => {
        setEnrollmentToTransfer(enrollment);
        setTransferGroupId('');
        setShowTransferModal(true);
    };

    const confirmTransfer = async () => {
        if (!transferGroupId) {
            setMessage({ type: 'error', text: 'Selecciona el grupo destino' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }
        setTransferLoading(true);
        try {
            const result = await api.post(`/enrollments/${enrollmentToTransfer.id}/transfer`, {
                targetGroupId: parseInt(transferGroupId)
            });
            setShowTransferModal(false);
            setEnrollmentToTransfer(null);
            setTransferGroupId('');
            if (result.data.warnings && result.data.warnings.length > 0) {
                setMessage({ type: 'error', text: result.data.message });
            } else {
                setMessage({ type: 'success', text: result.data.message });
            }
            loadEnrollments(false);
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Error al trasladar' });
        } finally {
            setTransferLoading(false);
            setTimeout(() => setMessage(null), 5000);
        }
    };

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

            <div className="flex mb-6 border-b border-gray-200 gap-0 flex-wrap">
                {[
                    { id: 'create',     label: 'Crear matrícula' },
                    { id: 'list',       label: 'Matrículas' },
                    { id: 'unenrolled', label: 'Egresados / No matric.' },
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

                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Valor de matrícula (COP)</label>
                            <input
                                type="number"
                                min="0"
                                value={form.enrollmentValue}
                                onChange={e => setForm({ ...form, enrollmentValue: e.target.value })}
                                placeholder="Ej: 1500000"
                                className="w-full md:w-64 px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                            />
                        </div>

                        {/* Datos complementarios del estudiante (para actualizar si algo cambió) */}
                        {studentDetail && (
                            <div className="border border-gray-100 rounded-lg overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setShowComp(v => !v)}
                                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50/70 hover:bg-gray-100/70 transition text-left"
                                >
                                    <span className="text-sm font-medium text-gray-700">
                                        Datos complementarios <span className="text-gray-400 font-normal">— actualiza si el estudiante cambió de teléfono, dirección, etc.</span>
                                    </span>
                                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${showComp ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                {showComp && (
                                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {[
                                            { k: 'document_issue_date',  label: 'Fecha de expedición del documento', type: 'date', ph: '' },
                                            { k: 'document_issue_place', label: 'Lugar de expedición del documento', type: 'text', ph: 'Ej: Popayán, Cauca' },
                                            { k: 'phone_landline',  label: 'Teléfono fijo',   type: 'text',  ph: 'Ej: 6043221234' },
                                            { k: 'phone_mobile1',   label: 'Celular del padre',  type: 'text',  ph: 'Celular del padre' },
                                            { k: 'phone_mobile2',   label: 'Celular de la madre', type: 'text',  ph: 'Celular de la madre' },
                                            { k: 'email_father',    label: 'Correo del padre',type: 'email', ph: 'correo@ejemplo.com' },
                                            { k: 'email_mother',    label: 'Correo de la madre', type: 'email', ph: 'correo@ejemplo.com' },
                                            { k: 'address',         label: 'Dirección de residencia', type: 'text', ph: 'Dirección' },
                                            { k: 'withdrawal_date', label: 'Fecha de retiro', type: 'date',  ph: '' },
                                            { k: 'withdrawal_reason', label: 'Motivo del retiro', type: 'text', ph: 'Motivo del retiro (si aplica)' },
                                        ].map(f => (
                                            <div key={f.k}>
                                                <label className="block text-sm font-medium text-gray-600 mb-1">{f.label}</label>
                                                <input
                                                    type={f.type}
                                                    value={compForm[f.k]}
                                                    onChange={e => setCompForm({ ...compForm, [f.k]: e.target.value })}
                                                    placeholder={f.ph}
                                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                                />
                                            </div>
                                        ))}
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-600 mb-1">Observaciones</label>
                                            <textarea
                                                rows={2}
                                                value={compForm.observations}
                                                onChange={e => setCompForm({ ...compForm, observations: e.target.value })}
                                                placeholder="Información adicional relevante del estudiante"
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                            />
                                        </div>

                                        {/* Documentos entregados */}
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-600 mb-2">
                                                Documentos entregados <span className="text-gray-400 font-normal">({compDocs.length} de {STUDENT_DOCS.length})</span>
                                            </label>
                                            <div className="flex flex-wrap gap-x-6 gap-y-2">
                                                {STUDENT_DOCS.map(d => (
                                                    <label key={d.code} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                                        <input type="checkbox"
                                                            checked={compDocs.includes(d.code)}
                                                            onChange={() => toggleDoc(d.code)}
                                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                                        {d.label}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        <p className="md:col-span-2 text-xs text-gray-400">
                                            Estos cambios se guardan en la ficha del estudiante al matricular.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

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
                <EnrollmentsByYear
                    refreshKey={refreshKey}
                    onTransfer={handleTransferClick}
                    onDelete={handleDeleteClick}
                />
            )}
            {activeTab === 'unenrolled' && (
                <UnenrolledStudents activeYear={activeYear} refreshKey={refreshKey} onEnroll={handleEnrollExisting} />
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

            {showTransferModal && enrollmentToTransfer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-base font-semibold text-gray-800 mb-1">Trasladar estudiante</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Mover a <strong>{enrollmentToTransfer.student_name}</strong> desde el curso{' '}
                            <strong>{enrollmentToTransfer.grade_name ? `${enrollmentToTransfer.grade_name} ${enrollmentToTransfer.group_letter || ''}`.trim() : enrollmentToTransfer.group_name}</strong> a otro grupo del mismo año lectivo.
                            Las notas guardadas se conservan y los folios se recalculan automáticamente.
                        </p>

                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-700">
                            Si el grupo destino no tiene docente asignado para alguna asignatura, esas notas
                            quedarán vinculadas al docente anterior hasta que se asigne uno en el nuevo grupo.
                        </div>

                        <div className="mb-5">
                            <label className="block text-sm font-medium text-gray-600 mb-1">Grupo destino</label>
                            <select
                                value={transferGroupId}
                                onChange={e => setTransferGroupId(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                            >
                                <option value="">Seleccione grupo destino</option>
                                {groups
                                    .filter(g => g.id !== enrollmentToTransfer.group_id)
                                    .map(g => (
                                        <option key={g.id} value={g.id}>{g.full_name}</option>
                                    ))
                                }
                            </select>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => { setShowTransferModal(false); setEnrollmentToTransfer(null); }}
                                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg transition"
                                disabled={transferLoading}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmTransfer}
                                disabled={transferLoading || !transferGroupId}
                                className="px-4 py-2 text-sm bg-blue-700 hover:bg-blue-800 text-white rounded-lg transition disabled:opacity-50 font-medium"
                            >
                                {transferLoading ? 'Trasladando...' : 'Confirmar traslado'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Enrollments;

