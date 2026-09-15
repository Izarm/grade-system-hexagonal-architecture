import { useState, useEffect, useRef } from 'react';
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
    const hasUnsavedChanges = useRef(false);
    const inputRefs = useRef({});

    const { activeYear, loading: yearLoading } = useActiveAcademicYear();

    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (hasUnsavedChanges.current) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

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
                        const n1 = parseNote1(s.grade.normal_note);
                        const a1 = parseNote1(s.grade.aptitudinal_note);
                        gradesData[s.id] = {
                            normal: n1 !== null ? String(n1) : '',
                            aptitudinal: a1 !== null ? String(a1) : ''
                        };
                        absencesData[s.id] = s.grade.absences !== null && s.grade.absences !== undefined ? String(s.grade.absences) : '';
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

    // Solo dígitos y un punto decimal, máximo 1 decimal, tope 10. Nada de - + e , etc.
    const sanitizeNote = (value) => {
        let v = (value ?? '').toString().replace(',', '.').replace(/[^0-9.]/g, '');
        const firstDot = v.indexOf('.');
        if (firstDot !== -1) {
            const intPart = v.slice(0, firstDot);
            let dec = v.slice(firstDot + 1).replace(/\./g, '').slice(0, 1);
            v = intPart + '.' + dec;
        }
        if (v !== '' && v !== '.') {
            const num = parseFloat(v);
            if (!isNaN(num) && num > 10) v = '10';
        }
        return v;
    };

    // Convierte a número con un decimal para guardar/enviar
    const parseNote1 = (v) => {
        if (v === undefined || v === null || v === '') return null;
        const n = parseFloat(v);
        if (isNaN(n)) return null;
        return Math.round(n * 10) / 10;
    };

    const updateNormalNote = (studentId, value) => {
        hasUnsavedChanges.current = true;
        const clean = sanitizeNote(value);
        setGrades(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], normal: clean }
        }));
    };

    const updateAptitudinal = (studentId, value) => {
        if (isElective) return;
        hasUnsavedChanges.current = true;
        const clean = sanitizeNote(value);
        setGrades(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], aptitudinal: clean }
        }));
    };

    const updateAbsences = (studentId, value) => {
        // Solo enteros positivos
        const clean = (value ?? '').toString().replace(/[^0-9]/g, '');
        setAbsences(prev => ({
            ...prev,
            [studentId]: clean
        }));
    };

    // Columnas navegables según el tipo de materia
    const getColumns = () => isElective ? ['normal', 'absences'] : ['normal', 'aptitudinal', 'absences'];

    const focusCell = (studentId, col) => {
        const el = inputRefs.current[`${studentId}:${col}`];
        if (el) {
            el.focus();
            if (typeof el.select === 'function') el.select();
        }
    };

    // Enter baja al mismo campo del siguiente estudiante
    const handleKeyDown = (e, orderedStudents, studentId, col) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const idx = orderedStudents.findIndex(s => s.id === studentId);
            const next = orderedStudents[idx + 1];
            if (next) focusCell(next.id, col);
        }
    };

    // Aplica un valor a la estructura mutable de grades/absences
    const applyCell = (gObj, aObj, studentId, col, raw) => {
        if (col === 'absences') {
            aObj[studentId] = (raw ?? '').toString().replace(/[^0-9]/g, '');
        } else {
            const base = gObj[studentId] || { normal: '', aptitudinal: '' };
            gObj[studentId] = { ...base, [col]: sanitizeNote(raw) };
        }
    };

    // Pegar varias filas/columnas desde Excel
    const handlePaste = (e, orderedStudents, studentId, startCol) => {
        const text = e.clipboardData?.getData('text');
        if (!text) return;
        const rows = text.replace(/\r/g, '').split('\n');
        // quitar última fila vacía típica de Excel
        if (rows.length > 1 && rows[rows.length - 1] === '') rows.pop();
        // Si es un solo valor sin tabs, dejar el pegado normal del navegador
        if (rows.length === 1 && !rows[0].includes('\t')) return;
        e.preventDefault();
        if (!periodOpen) return;

        const cols = getColumns();
        const startColIdx = cols.indexOf(startCol);
        const startRowIdx = orderedStudents.findIndex(s => s.id === studentId);

        const gObj = { ...grades };
        const aObj = { ...absences };

        rows.forEach((row, ri) => {
            const target = orderedStudents[startRowIdx + ri];
            if (!target) return;
            const cells = row.split('\t');
            cells.forEach((cell, ci) => {
                const colName = cols[startColIdx + ci];
                if (!colName) return;
                applyCell(gObj, aObj, target.id, colName, cell);
            });
        });

        setGrades(gObj);
        setAbsences(aObj);
        hasUnsavedChanges.current = true;
        showNotification(`${rows.length} fila${rows.length !== 1 ? 's' : ''} pegada${rows.length !== 1 ? 's' : ''} desde Excel`);
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
            const normal = parseNote1(grade.normal);
            const aptitudinal = isElective ? null : parseNote1(grade.aptitudinal);
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
            hasUnsavedChanges.current = false;
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
                    <div className="flex items-center gap-2">
                        <select
                            value={filters.periodId}
                            onChange={(e) => setFilters({ ...filters, periodId: e.target.value })}
                            className="flex-1 px-3 py-2 border rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
                        >
                            <option value="">Seleccione período</option>
                            {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        {filters.periodId && (
                            <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${
                                periodOpen
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-700'
                            }`}>
                                {periodOpen ? '● Abierto' : '● Cerrado'}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {loading && <div className="text-center py-8">Cargando estudiantes...</div>}

            {!loading && students.length === 0 && filters.assignmentId && filters.periodId && (
                <div className="text-center py-8 text-gray-500">No hay estudiantes matriculados.</div>
            )}

            {!loading && students.length > 0 && (() => {
                // Para electivas: agrupar por grado + sección (ej: "1° A", "1° B")
                const groupKey = (s) => `${s.grade_name || 'Sin grado'}${s.group_name ? ' ' + s.group_name : ''}`;
                const allGradeNames = isElective
                    ? [...new Set(students.map(groupKey))].sort((a, b) => {
                        const numA = parseInt(a) || 999;
                        const numB = parseInt(b) || 999;
                        if (numA !== numB) return numA - numB;
                        return a.localeCompare(b, 'es');
                    })
                    : [];

                const filteredGradeNames = allGradeNames.filter(g =>
                    g.toLowerCase().includes(gradeSearch.toLowerCase())
                );

                const visibleStudents = isElective && selectedGradeFilter
                    ? students.filter(s => groupKey(s) === selectedGradeFilter)
                    : students;

                // Grados a mostrar (electivas) y orden global de navegación
                const gradesToShow = selectedGradeFilter
                    ? [selectedGradeFilter]
                    : filteredGradeNames.length > 0 ? filteredGradeNames : allGradeNames;
                const orderedStudents = isElective
                    ? gradesToShow.flatMap(gn => students.filter(s => groupKey(s) === gn))
                    : visibleStudents;

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
                                <input type="text" inputMode="decimal" value={normalValue}
                                    ref={(el) => { inputRefs.current[`${student.id}:normal`] = el; }}
                                    onChange={(e) => updateNormalNote(student.id, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, orderedStudents, student.id, 'normal')}
                                    onPaste={(e) => handlePaste(e, orderedStudents, student.id, 'normal')}
                                    disabled={!periodOpen}
                                    className="w-24 px-2 py-1 border rounded focus:ring-1 focus:ring-blue-500 outline-none" />
                            </td>
                            {!isElective && (
                                <td className="px-4 py-3">
                                    <input type="text" inputMode="decimal" value={aptitudinalValue}
                                        ref={(el) => { inputRefs.current[`${student.id}:aptitudinal`] = el; }}
                                        onChange={(e) => updateAptitudinal(student.id, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(e, orderedStudents, student.id, 'aptitudinal')}
                                        onPaste={(e) => handlePaste(e, orderedStudents, student.id, 'aptitudinal')}
                                        disabled={!periodOpen}
                                        className="w-24 px-2 py-1 border rounded focus:ring-1 focus:ring-blue-500 outline-none" />
                                </td>
                            )}
                            <td className="px-4 py-3">
                                <input type="text" inputMode="numeric" value={absenceValue}
                                    ref={(el) => { inputRefs.current[`${student.id}:absences`] = el; }}
                                    onChange={(e) => updateAbsences(student.id, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, orderedStudents, student.id, 'absences')}
                                    onPaste={(e) => handlePaste(e, orderedStudents, student.id, 'absences')}
                                    disabled={!periodOpen}
                                    className="w-20 px-2 py-1 border rounded focus:ring-1 focus:ring-blue-500 outline-none" />
                            </td>
                        </tr>
                    );
                };

                return (
                    <div>
                        {!periodOpen && (
                            <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4">
                                <span className="text-lg font-bold">!</span>
                                <div>
                                    <p className="font-semibold text-sm">Período cerrado — solo lectura</p>
                                    <p className="text-xs text-red-600">No se pueden registrar ni modificar notas en este período. Contacta al administrador para reabrirlo.</p>
                                </div>
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
                                    return gradesToShow.map(gradeName => {
                                        const gradeStudents = students.filter(s => groupKey(s) === gradeName);
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