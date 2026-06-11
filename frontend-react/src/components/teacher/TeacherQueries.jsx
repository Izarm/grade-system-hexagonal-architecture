import { useState, useEffect } from 'react';
import api from '../../api/client';
import { useActiveAcademicYear } from '../../hooks/useActiveAcademicYear';
import { useRefresh } from '../../contexts/RefreshContext';

const TeacherQueries = () => {
    const { refreshKey } = useRefresh();
    const [periods, setPeriods] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [students, setStudents] = useState([]);
    const [filters, setFilters] = useState({ periodId: '', assignmentId: '' });
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [isElective, setIsElective] = useState(false);
    const [message, setMessage] = useState(null);

    const { activeYear, loading: yearLoading } = useActiveAcademicYear();

    const extractData = (response) => {
        if (!response) return [];
        if (response.data && Array.isArray(response.data)) return response.data;
        if (Array.isArray(response)) return response;
        if (response.data && response.data.data && Array.isArray(response.data.data)) return response.data.data;
        return [];
    };

    const loadPeriods = async () => {
        if (!activeYear) return;
        try {
            const res = await api.get(`/periods?academicYearId=${activeYear.id}&onlyOpen=true`);
            const periodsData = extractData(res.data);
            setPeriods(periodsData);
        } catch (error) {
            console.error('Error cargando periodos:', error);
            setPeriods([]);
        }
    };

    const loadAssignments = async () => {
        if (!activeYear) return;
        setLoading(true);
        try {
            const res = await api.get(`/subject-assignments?academicYearId=${activeYear.id}`);
            let assignmentsData = extractData(res.data);
            if (assignmentsData.assignments) assignmentsData = assignmentsData.assignments;

            const uniqueMap = new Map();
            for (const a of assignmentsData) {
                if (!uniqueMap.has(a.id)) uniqueMap.set(a.id, a);
            }
            setAssignments(Array.from(uniqueMap.values()));
        } catch (error) {
            console.error('Error cargando asignaciones:', error);
            setAssignments([]);
        } finally {
            setLoading(false);
        }
    };

    const loadGrades = async () => {
        const { periodId, assignmentId } = filters;
        if (!periodId || !assignmentId) {
            setMessage({ type: 'error', text: 'Seleccione período y asignación' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }

        setLoading(true);
        setHasSearched(true);
        try {
            const selectedAssignment = assignments.find(a => a.id.toString() === assignmentId);
            const isElectiveAssignment = selectedAssignment?.is_elective === 1;
            setIsElective(isElectiveAssignment);

            const res = await api.get(`/reports/teacher-assignments`, {
                params: {
                    academicYearId: activeYear.id,
                    subjectAssignmentId: assignmentId,
                    periodId: periodId
                }
            });

            setStudents(res.data.students || []);
            setMessage({
                type: 'info',
                text: res.data.periodStatus === 'open' ? 'Período abierto' : 'Período cerrado (solo consulta)'
            });
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            console.error('Error consultando notas:', error);
            setMessage({ type: 'error', text: 'Error al consultar las notas' });
            setTimeout(() => setMessage(null), 3000);
            setStudents([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeYear) {
            loadPeriods();
            loadAssignments();
        }
    }, [activeYear, refreshKey]);

    const formatValue = (value) => {
        if (value === null || value === undefined) return '-';
        return value;
    };

    if (yearLoading) return <div className="text-center py-8">Cargando año activo...</div>;
    if (!activeYear) return <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center"><p className="text-blue-700">No hay un año lectivo activo en este momento.</p></div>;

    return (
        <div className="max-w-7xl mx-auto px-6 py-6">
            {message && (
                <div className={`fixed top-5 right-5 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm ${
                    message.type === 'success' ? 'bg-green-500 text-white' : 
                    message.type === 'error' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
                }`}>
                    {message.text}
                </div>
            )}

            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">Año lectivo activo: <strong>{activeYear.name}</strong></p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-base font-semibold mb-4">Consultar notas</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="block text-xs font-medium mb-1">Asignación</label>
                        <select
                            value={filters.assignmentId}
                            onChange={(e) => {
                                const selected = assignments.find(a => a.id.toString() === e.target.value);
                                setFilters({ ...filters, assignmentId: e.target.value });
                                setIsElective(selected?.is_elective === 1);
                            }}
                            className="w-full px-3 py-2 border rounded-lg"
                        >
                            <option value="">Seleccione asignación</option>
                            {assignments.map(a => {
                                const isElectiveAss = a.is_elective === 1;
                                const gradeName = a.grade_name || a.gradeName || '';
                                const subjectName = a.subject_name || a.subjectName;
                                const label = isElectiveAss
                                    ? `[Electiva] - ${subjectName}`
                                    : `Grado ${gradeName} - ${subjectName}`;
                                return <option key={a.id} value={a.id}>{label}</option>;
                            })}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1">Período</label>
                        <select
                            value={filters.periodId}
                            onChange={(e) => setFilters({ ...filters, periodId: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg"
                        >
                            <option value="">Seleccione período</option>
                            {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                </div>

                <button
                    onClick={loadGrades}
                    disabled={loading}
                    className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg"
                >
                    {loading ? 'Cargando...' : 'Consultar notas'}
                </button>

                {hasSearched && !loading && students.length === 0 && (
                    <div className="mt-6 text-center py-8 text-gray-400">No hay notas registradas para esta asignación y período</div>
                )}

                {students.length > 0 && (() => {
                    const fmt = (v) => v !== null && v !== undefined ? parseFloat(v).toFixed(2) : '-';

                    const renderRow = (s, idx) => {
                        const normal = s.grade?.normal_note ?? null;
                        const aptitudinal = s.grade?.aptitudinal_note ?? null;
                        const absencesValue = s.grade?.absences ?? null;
                        return (
                            <tr key={s.id} className="hover:bg-gray-50">
                                <td className="px-3 py-3 border text-center text-sm font-medium text-gray-500 w-10">{idx + 1}</td>
                                <td className="px-4 py-3 border">{s.full_name}</td>
                                <td className="px-4 py-3 border">{s.student_code || '-'}</td>
                                <td className="px-4 py-3 border text-center">{fmt(normal)}</td>
                                {!isElective && <td className="px-4 py-3 border text-center">{fmt(aptitudinal)}</td>}
                                <td className="px-4 py-3 border text-center">{absencesValue !== null ? absencesValue : '-'}</td>
                            </tr>
                        );
                    };

                    if (isElective) {
                        const gradeNames = [...new Set(students.map(s => s.grade_name || 'Sin grado'))].sort((a, b) => {
                            const nA = parseInt(a) || 999;
                            const nB = parseInt(b) || 999;
                            return nA !== nB ? nA - nB : a.localeCompare(b);
                        });
                        return (
                            <div className="mt-6 space-y-6">
                                {gradeNames.map(gradeName => {
                                    const gradeStudents = students.filter(s => (s.grade_name || 'Sin grado') === gradeName);
                                    return (
                                        <div key={gradeName}>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded-full">{gradeName}</span>
                                                <span className="text-xs text-gray-400">{gradeStudents.length} estudiante{gradeStudents.length !== 1 ? 's' : ''}</span>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm border">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-3 py-3 border text-center w-10">N°</th>
                                                            <th className="px-4 py-3 border text-left">Estudiante</th>
                                                            <th className="px-4 py-3 border text-left">Código</th>
                                                            <th className="px-4 py-3 border text-center">Nota</th>
                                                            <th className="px-4 py-3 border text-center">Faltas</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>{gradeStudents.map((s, i) => renderRow(s, i))}</tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    }

                    return (
                        <div className="mt-6 overflow-x-auto">
                            <table className="w-full text-sm border">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-3 py-3 border text-center w-10">N°</th>
                                        <th className="px-4 py-3 border text-left">Estudiante</th>
                                        <th className="px-4 py-3 border text-left">Código</th>
                                        <th className="px-4 py-3 border text-center">Nota</th>
                                        <th className="px-4 py-3 border text-center">Nota Actitudinal</th>
                                        <th className="px-4 py-3 border text-center">Faltas</th>
                                    </tr>
                                </thead>
                                <tbody>{students.map((s, i) => renderRow(s, i))}</tbody>
                            </table>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
};

export default TeacherQueries;