import { useState, useEffect } from 'react';
import api from '../../api/client';
import { useActiveAcademicYear } from '../../hooks/useActiveAcademicYear';
import { useRefresh } from '../../contexts/RefreshContext';

const GradeRegistration = () => {
    const { refreshKey } = useRefresh();
    const [assignments, setAssignments] = useState([]);
    const [periods, setPeriods] = useState([]);
    const [students, setStudents] = useState([]);
    const [periodOpen, setPeriodOpen] = useState(true);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [filters, setFilters] = useState({ assignmentId: '', periodId: '' });
    const [grades, setGrades] = useState({});
    const [absences, setAbsences] = useState({});
    const [message, setMessage] = useState(null);
    const [isElective, setIsElective] = useState(false);
    const [gradeSearch, setGradeSearch] = useState('');
    const [selectedGradeFilter, setSelectedGradeFilter] = useState('');

    const { activeYear, loading: yearLoading } = useActiveAcademicYear();

    const extractData = (response) => {
        if (!response) return [];
        if (response.data && Array.isArray(response.data)) return response.data;
        if (Array.isArray(response)) return response;
        if (response.data && response.data.data && Array.isArray(response.data.data)) return response.data.data;
        return [];
    };

    const showNotification = (text, type = 'success') => {
        setMessage({ text, type });
        setTimeout(() => setMessage(null), 3000);
    };

    const loadAssignments = async () => {
        if (!activeYear) return;
        setLoading(true);
        try {
            const res = await api.get(`/subject-assignments?academicYearId=${activeYear.id}`);
            let assignmentsData = extractData(res.data);
            if (assignmentsData.assignments) assignmentsData = assignmentsData.assignments;

            // Eliminar duplicados por id
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

    const loadPeriodsByYear = async () => {
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

    const loadStudentsAndGrades = async () => {
        const { assignmentId, periodId } = filters;
        if (!assignmentId || !periodId) return;

        setLoading(true);
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
            setPeriodOpen(res.data.periodStatus === 'open');

            const gradesData = {};
            const absencesData = {};
            if (res.data.students && Array.isArray(res.data.students)) {
                res.data.students.forEach(s => {
                    if (s.grade) {
                        gradesData[s.id] = {
                            normal: s.grade.normal_note !== null ? s.grade.normal_note : '',
                            aptitudinal: s.grade.aptitudinal_note !== null ? s.grade.aptitudinal_note : ''
                        };
                        absencesData[s.id] = s.grade.absences !== null && s.grade.absences !== undefined ? s.grade.absences : '';
                    } else {
                        gradesData[s.id] = { normal: '', aptitudinal: '' };
                        absencesData[s.id] = '';
                    }
                });
            }
            setGrades(gradesData);
            setAbsences(absencesData);
        } catch (error) {
            console.error('Error cargando estudiantes:', error);
            showNotification('Error al cargar los datos', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeYear) {
            loadAssignments();
            loadPeriodsByYear();
        }
    }, [activeYear, refreshKey]);

    useEffect(() => {
        if (filters.assignmentId && filters.periodId) {
            loadStudentsAndGrades();
        }
    }, [filters.assignmentId, filters.periodId, refreshKey]);

    const updateNormalNote = (studentId, value) => {
        const num = value === '' ? null : parseFloat(value);
        setGrades(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                normal: (num !== null && !isNaN(num)) ? num : null
            }
        }));
    };

    const updateAptitudinal = (studentId, value) => {
        if (isElective) return;
        const num = value === '' ? null : parseFloat(value);
        setGrades(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                aptitudinal: (num !== null && !isNaN(num)) ? num : null
            }
        }));
    };

    const updateAbsences = (studentId, value) => {
        const num = value === '' ? null : parseInt(value);
        setAbsences(prev => ({
            ...prev,
            [studentId]: (num !== null && !isNaN(num)) ? num : null
        }));
    };

    const saveAllGrades = async () => {
        if (!periodOpen) {
            showNotification('No se pueden guardar notas en un periodo cerrado', 'error');
            return;
        }
        if (!filters.periodId || isNaN(parseInt(filters.periodId))) {
            showNotification('Seleccione un periodo válido', 'error');
            return;
        }
        setSaving(true);
        let savedCount = 0;
        let errorCount = 0;
        for (const student of students) {
            const grade = grades[student.id];
            const absence = absences[student.id];
            if (!grade) continue;
            const normal = grade.normal !== undefined && grade.normal !== null && grade.normal !== '' ? grade.normal : null;
            const aptitudinal = isElective ? null : (grade.aptitudinal !== undefined && grade.aptitudinal !== null && grade.aptitudinal !== '' ? grade.aptitudinal : null);
            const absenceValue = absence !== undefined && absence !== null && absence !== '' ? parseInt(absence) : null;
            
            if (normal === null && aptitudinal === null && absenceValue === null) continue;
            try {
                await api.post('/grade-records/grades', {
                    enrollmentId: student.enrollment_id,
                    periodId: parseInt(filters.periodId),
                    subjectAssignmentId: parseInt(filters.assignmentId),
                    normalNote: normal,
                    aptitudinalNote: aptitudinal,
                    absences: absenceValue,
                    isElective: isElective
                });
                savedCount++;
            } catch (err) {
                console.error('Error guardando para', student.full_name, err);
                errorCount++;
            }
        }
        if (savedCount > 0) {
            showNotification(`${savedCount} registro${savedCount !== 1 ? 's' : ''} guardado${savedCount !== 1 ? 's' : ''} correctamente`);
            await loadStudentsAndGrades();
        } else if (errorCount > 0) {
            showNotification(`Error al guardar ${errorCount} registro${errorCount !== 1 ? 's' : ''}`, 'error');
        }
        setSaving(false);
    };

    if (yearLoading) {
        return <div className="flex justify-center py-8">Cargando año activo...</div>;
    }

    if (!activeYear) {
        return (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <p className="text-blue-700">No hay un año lectivo activo en este momento.</p>
            </div>
        );
    }

    return (
        <div className="relative max-w-6xl mx-auto px-6 py-6">
            {message && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
                    message.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                }`}>
                    {message.text}
                </div>
            )}

            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                    Año lectivo activo: <strong>{activeYear.name}</strong>
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Asignación</label>
                    <select
                        value={filters.assignmentId}
                        onChange={(e) => {
                            const selected = assignments.find(a => a.id.toString() === e.target.value);
                            setFilters({ ...filters, assignmentId: e.target.value });
                            setIsElective(selected?.is_elective === 1);
                            setGradeSearch('');
                            setSelectedGradeFilter('');
                        }}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
                    >
                        <option value="">Seleccione asignación</option>
                        {assignments.map(a => {
                            const isElectiveAss = a.is_elective === 1;
                            const gradeName = a.grade_name || a.gradeName || '';
                            const subjectName = a.subject_name || a.subjectName;
                            const label = isElectiveAss
                                ? `[Electiva] - ${subjectName}`
                                : `Grado ${gradeName} - ${subjectName}`;
                            return (
                                <option key={a.id} value={a.id}>{label}</option>
                            );
                        })}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Período</label>
                    <select
                        value={filters.periodId}
                        onChange={(e) => setFilters({ ...filters, periodId: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
                    >
                        <option value="">Seleccione período</option>
                        {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
            </div>

            {loading && <div className="text-center py-8">Cargando estudiantes...</div>}

            {!loading && students.length === 0 && filters.assignmentId && filters.periodId && (
                <div className="text-center py-8 text-gray-500">No hay estudiantes matriculados.</div>
            )}

            {!loading && students.length > 0 && (() => {
                // Para electivas: agrupar por grado y aplicar filtro
                const allGradeNames = isElective
                    ? [...new Set(students.map(s => s.grade_name || 'Sin grado'))].sort((a, b) => {
                        const numA = parseInt(a) || 999;
                        const numB = parseInt(b) || 999;
                        if (numA !== numB) return numA - numB;
                        return a.localeCompare(b);
                    })
                    : [];

                const filteredGradeNames = allGradeNames.filter(g =>
                    g.toLowerCase().includes(gradeSearch.toLowerCase())
                );

                const visibleStudents = isElective && selectedGradeFilter
                    ? students.filter(s => (s.grade_name || 'Sin grado') === selectedGradeFilter)
                    : students;

                const renderStudentRow = (student, idx) => {
                    const normalValue = grades[student.id]?.normal !== undefined && grades[student.id]?.normal !== null ? grades[student.id].normal : '';
                    const aptitudinalValue = !isElective && grades[student.id]?.aptitudinal !== undefined && grades[student.id]?.aptitudinal !== null ? grades[student.id].aptitudinal : '';
                    const absenceValue = absences[student.id] !== undefined && absences[student.id] !== null ? absences[student.id] : '';
                    return (
                        <tr key={student.id} className="hover:bg-gray-50">
                            <td className="px-3 py-3 text-center text-sm font-medium text-gray-500 w-10">{idx + 1}</td>
                            <td className="px-4 py-3 text-sm">{student.full_name}</td>
                            <td className="px-4 py-3 text-sm">{student.student_code || '-'}</td>
                            {!isElective && <td className="px-4 py-3 text-sm">{student.grade_name || '-'}</td>}
                            <td className="px-4 py-3">
                                <input type="number" step="0.01" min="0" max="10" value={normalValue}
                                    onChange={(e) => updateNormalNote(student.id, e.target.value)}
                                    disabled={!periodOpen}
                                    className="w-24 px-2 py-1 border rounded focus:ring-1 focus:ring-blue-500 outline-none" />
                            </td>
                            {!isElective && (
                                <td className="px-4 py-3">
                                    <input type="number" step="0.01" min="0" max="10" value={aptitudinalValue}
                                        onChange={(e) => updateAptitudinal(student.id, e.target.value)}
                                        disabled={!periodOpen}
                                        className="w-24 px-2 py-1 border rounded focus:ring-1 focus:ring-blue-500 outline-none" />
                                </td>
                            )}
                            <td className="px-4 py-3">
                                <input type="number" step="1" min="0" value={absenceValue}
                                    onChange={(e) => updateAbsences(student.id, e.target.value)}
                                    disabled={!periodOpen}
                                    className="w-20 px-2 py-1 border rounded focus:ring-1 focus:ring-blue-500 outline-none" />
                            </td>
                        </tr>
                    );
                };

                return (
                    <div>
                        {!periodOpen && (
                            <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4">
                                ADVERTENCIA: Este período está cerrado. No se pueden modificar notas.
                            </div>
                        )}

                        {/* Buscador y filtro por grado (solo electivas) */}
                        {isElective && (
                            <div className="mb-4 flex flex-wrap gap-2 items-center">
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Buscar grado..."
                                        value={gradeSearch}
                                        onChange={(e) => { setGradeSearch(e.target.value); setSelectedGradeFilter(''); }}
                                        className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none w-44"
                                    />
                                    <svg className="w-4 h-4 text-gray-400 absolute left-2 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <button
                                    onClick={() => setSelectedGradeFilter('')}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                                        !selectedGradeFilter ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    Todos
                                </button>
                                {filteredGradeNames.map(gradeName => (
                                    <button
                                        key={gradeName}
                                        onClick={() => setSelectedGradeFilter(gradeName)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                                            selectedGradeFilter === gradeName
                                                ? 'bg-blue-700 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        {gradeName}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="overflow-x-auto">
                            {isElective ? (
                                // Vista agrupada por grado para electivas
                                (() => {
                                    const gradesToShow = selectedGradeFilter
                                        ? [selectedGradeFilter]
                                        : filteredGradeNames.length > 0 ? filteredGradeNames : allGradeNames;

                                    return gradesToShow.map(gradeName => {
                                        const gradeStudents = students.filter(s => (s.grade_name || 'Sin grado') === gradeName);
                                        if (gradeStudents.length === 0) return null;
                                        return (
                                            <div key={gradeName} className="mb-6">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded-full">
                                                        {gradeName}
                                                    </span>
                                                    <span className="text-xs text-gray-400">{gradeStudents.length} estudiante{gradeStudents.length !== 1 ? 's' : ''}</span>
                                                </div>
                                                <table className="w-full border rounded-lg">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-3 py-3 text-center text-sm font-medium text-gray-500 w-10">N°</th>
                                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Estudiante</th>
                                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Código</th>
                                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Nota</th>
                                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Faltas</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-200">
                                                        {gradeStudents.map((s, i) => renderStudentRow(s, i))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        );
                                    });
                                })()
                            ) : (
                                // Vista normal para materias regulares
                                <table className="w-full border rounded-lg">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-3 py-3 text-center text-sm font-medium text-gray-500 w-10">N°</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Estudiante</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Código</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Grado</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Nota</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Nota Actitudinal</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Faltas</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {visibleStudents.map((s, i) => renderStudentRow(s, i))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {periodOpen && (
                            <div className="mt-6 flex justify-end">
                                <button
                                    onClick={saveAllGrades}
                                    disabled={saving}
                                    className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-2 rounded-lg transition disabled:opacity-50"
                                >
                                    {saving ? 'Guardando...' : 'Guardar todas las notas'}
                                </button>
                            </div>
                        )}
                    </div>
                );
            })()}
        </div>
    );
};

export default GradeRegistration;