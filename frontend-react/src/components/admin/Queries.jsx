import React, { useState, useEffect, useCallback, Fragment } from 'react';
import api from '../../api/client';
import { useActiveAcademicYear } from '../../hooks/useActiveAcademicYear';
import { useRefresh } from '../../contexts/RefreshContext';

// ── Auditorias ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;
const FIELD_COLORS = {
    'Nota Normal':      'bg-blue-100 text-blue-700',
    'Nota Actitudinal': 'bg-green-100 text-green-700',
    'Faltas':           'bg-orange-100 text-orange-700',
};
const ACTION_LABELS = { create: 'Registro', update: 'Cambio' };
const ACTION_COLORS = { create: 'bg-emerald-100 text-emerald-700', update: 'bg-amber-100 text-amber-700' };
const normalizeStr = (str) => str?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') || '';

const AuditPanel = () => {
    const [rows, setRows]       = useState([]);
    const [total, setTotal]     = useState(0);
    const [page, setPage]       = useState(1);
    const [loading, setLoading] = useState(false);
    const [teachers, setTeachers]           = useState([]);
    const [periods, setPeriods]             = useState([]);
    const [filterTeacher, setFilterTeacher] = useState('');
    const [filterPeriod, setFilterPeriod]   = useState('');
    const [search, setSearch]               = useState('');
    const totalPages = Math.ceil(total / PAGE_SIZE);

    const load = useCallback(async (p = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: p, limit: PAGE_SIZE });
            if (filterTeacher) params.append('teacherId', filterTeacher);
            if (filterPeriod)  params.append('periodId', filterPeriod);
            const res = await api.get(`/audit-logs?${params}`);
            setRows(res.data.data || []);
            setTotal(res.data.total || 0);
            setPage(p);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [filterTeacher, filterPeriod]);

    useEffect(() => { load(1); }, [load]);
    useEffect(() => {
        api.get('/users/teachers').then(r => setTeachers(r.data || [])).catch(() => {});
        api.get('/periods').then(r => {
            const data = Array.isArray(r.data) ? r.data : (r.data.data || []);
            setPeriods(data);
        }).catch(() => {});
    }, []);

    const displayed = search
        ? rows.filter(r =>
            normalizeStr(r.student_name).includes(normalizeStr(search)) ||
            normalizeStr(r.teacher_name).includes(normalizeStr(search)) ||
            normalizeStr(r.subject_name).includes(normalizeStr(search)))
        : rows;

    const fmt = (iso) => {
        if (!iso) return '-';
        return new Date(iso).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' });
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-[15px] font-semibold text-gray-800">Auditoria de notas</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Historial de cambios realizados por los docentes</p>
                    </div>
                    <span className="text-xs text-gray-400">{total} registro{total !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por estudiante, docente o materia..."
                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none w-72" />
                    <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)}
                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none">
                        <option value="">Todos los docentes</option>
                        {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}
                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none">
                        <option value="">Todos los periodos</option>
                        {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <button onClick={() => load(1)}
                        className="px-3 py-1.5 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800 transition">
                        Filtrar
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            {['Fecha y hora','Docente','Estudiante','Curso','Materia','Periodo','Accion','Campo','Antes','Despues'].map(h => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr><td colSpan="10" className="px-4 py-8 text-center text-gray-400 text-sm">Cargando...</td></tr>
                        ) : displayed.length === 0 ? (
                            <tr><td colSpan="10" className="px-4 py-8 text-center text-gray-400 text-sm">No hay registros de auditoria</td></tr>
                        ) : displayed.map(row => (
                            <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{fmt(row.created_at)}</td>
                                <td className="px-4 py-3 font-medium text-gray-800">{row.teacher_name}</td>
                                <td className="px-4 py-3 text-gray-700">{row.student_name}</td>
                                <td className="px-4 py-3 text-gray-600">{row.group_name}</td>
                                <td className="px-4 py-3 text-gray-700">{row.subject_name}</td>
                                <td className="px-4 py-3 text-gray-600 text-xs">{row.period_name}</td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[row.action] || 'bg-gray-100 text-gray-600'}`}>
                                        {ACTION_LABELS[row.action] || row.action}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${FIELD_COLORS[row.field] || 'bg-gray-100 text-gray-600'}`}>
                                        {row.field}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {row.old_value != null
                                        ? <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-xs font-mono">{row.old_value}</span>
                                        : <span className="text-gray-300 text-xs">—</span>}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {row.new_value != null
                                        ? <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs font-mono">{row.new_value}</span>
                                        : <span className="text-gray-300 text-xs">—</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 py-4 border-t border-gray-100 bg-gray-50/50">
                    <button onClick={() => load(page - 1)} disabled={page === 1}
                        className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 transition">Anterior</button>
                    <span className="text-xs text-gray-500">Página {page} de {totalPages}</span>
                    <button onClick={() => load(page + 1)} disabled={page === totalPages}
                        className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 transition">Siguiente</button>
                </div>
            )}
        </div>
    );
};

// ── Consultas (main) ──────────────────────────────────────────────────────────

const Queries = () => {
    const [activeTab, setActiveTab] = useState('consultas');
    const { refreshKey } = useRefresh();
    const [allGrades, setAllGrades] = useState([]);
    const [selectedGrade, setSelectedGrade] = useState('');
    const [students, setStudents] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [electiveSubjectsList, setElectiveSubjectsList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [gradesData, setGradesData] = useState({});
    const [absencesData, setAbsencesData] = useState({});
    const [message, setMessage] = useState(null);
    const [selectedPeriod, setSelectedPeriod] = useState('');
    const [periods, setPeriods] = useState([]);
    const [hasSearched, setHasSearched] = useState(false);
    
    const [studentFilter, setStudentFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(20);

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

    const sortGrades = (gradesArray) => {
        return [...gradesArray].sort((a, b) => {
            const numA = parseInt(a.name) || 0;
            const numB = parseInt(b.name) || 0;
            if (numA !== numB) return numA - numB;
            return a.name.localeCompare(b.name);
        });
    };

    const loadGrades = async () => {
        try {
            const res = await api.get('/grades');
            const gradesData = extractData(res.data);
            const sortedGrades = sortGrades(gradesData);
            setAllGrades(sortedGrades);
        } catch (error) {
            console.error('Error cargando grados:', error);
            setAllGrades([]);
        }
    };

    const loadPeriods = async () => {
        if (!activeYear) return;
        try {
            const res = await api.get(`/periods?academicYearId=${activeYear.id}&onlyOpen=true`);
            const periodsData = extractData(res.data);
            setPeriods(periodsData);
            if (periodsData.length > 0 && !selectedPeriod) {
                setSelectedPeriod(periodsData[0].id.toString());
            }
        } catch (error) {
            console.error('Error cargando periodos:', error);
            setPeriods([]);
        }
    };

    const loadDataByGrade = async () => {
        if (!selectedGrade) return;
        
        setLoading(true);
        setSaveSuccess(false);
        try {
            const groupsRes = await api.get(`/groups/by-grade/${selectedGrade}`);
            const groups = extractData(groupsRes.data);
            const groupIds = new Set(groups.map(g => g.id));

            const assignmentsRes = await api.get(`/subject-assignments?academicYearId=${activeYear.id}`);
            let allAssignments = extractData(assignmentsRes.data);
            if (allAssignments.assignments) allAssignments = allAssignments.assignments;

            const regularSubjects = allAssignments.filter(a => a.is_elective !== 1 && groupIds.has(a.group_id));
            const electiveSubjects = allAssignments.filter(a => a.is_elective === 1);
            setSubjects(regularSubjects);
            setElectiveSubjectsList(electiveSubjects);
            
            if (groups.length === 0) {
                setStudents([]);
                setLoading(false);
                return;
            }

            let allEnrollments = [];
            for (const groupId of [...groupIds]) {
                const enrollmentsRes = await api.get(`/enrollments?groupId=${groupId}&academicYearId=${activeYear.id}`);
                const enrollments = extractData(enrollmentsRes.data);
                allEnrollments = [...allEnrollments, ...enrollments];
            }

            const studentsData = await Promise.all(allEnrollments.map(async e => {
                const studentRes = await api.get(`/students/${e.student_id}`);
                const studentData = studentRes.data;

                const gradesRes = await api.get(`/grade-records/student-report?studentId=${e.student_id}&academicYearId=${activeYear.id}`);
                let allGrades = extractData(gradesRes.data);
                
                if (selectedPeriod) {
                    allGrades = allGrades.filter(g => g.period_id === parseInt(selectedPeriod) || g.periodId === parseInt(selectedPeriod));
                }

                const notasMap = {};
                const absencesMap = {};
                allGrades.forEach(g => {
                    const assignmentId = g.subject_assignment_id || g.subjectAssignmentId;
                    if (assignmentId) {
                        notasMap[assignmentId] = {
                            normal: g.normal_note,
                            aptitudinal: g.aptitudinal_note
                        };
                        absencesMap[assignmentId] = g.absences;
                    }
                });

                const group = groups.find(g => g.id === e.group_id);
                const gradeName = group?.grade_name || '';

                return {
                    id: e.student_id,
                    full_name: studentData.full_name,
                    student_code: studentData.student_code,
                    folio: e.folio_number,
                    enrollment_id: e.id,
                    grade_name: gradeName,
                    notasMap: notasMap,
                    absencesMap: absencesMap
                };
            }));

            studentsData.sort((a, b) => (a.folio || 0) - (b.folio || 0));
            setStudents(studentsData);

            const initialGrades = {};
            const initialAbsences = {};
            const allSubjectsForInit = [...regularSubjects, ...electiveSubjects];
            studentsData.forEach(student => {
                allSubjectsForInit.forEach(subject => {
                    const key = `${student.id}_${subject.id}`;
                    initialGrades[key] = {
                        normal: student.notasMap[subject.id]?.normal !== undefined && student.notasMap[subject.id]?.normal !== null
                            ? student.notasMap[subject.id].normal : '',
                        aptitudinal: student.notasMap[subject.id]?.aptitudinal !== undefined && student.notasMap[subject.id]?.aptitudinal !== null
                            ? student.notasMap[subject.id].aptitudinal : ''
                    };
                    initialAbsences[key] = student.absencesMap[subject.id] !== undefined && student.absencesMap[subject.id] !== null
                        ? student.absencesMap[subject.id] : '';
                });
            });
            setGradesData(initialGrades);
            setAbsencesData(initialAbsences);
            setCurrentPage(1);

        } catch (error) {
            console.error('Error cargando datos del grado:', error);
            showNotification('Error al cargar los datos: ' + error.message, 'error');
            setStudents([]);
        } finally {
            setLoading(false);
        }
    };

    const loadDataByStudent = async () => {
        if (!studentFilter.trim()) return;
        setLoading(true);
        setSaveSuccess(false);
        try {
            // 1. Buscar estudiantes que coincidan con el término
            const studentsRes = await api.get('/students');
            const allStudentsList = extractData(studentsRes.data);
            const term = studentFilter.trim().toLowerCase();
            const matched = allStudentsList.filter(s =>
                s.full_name?.toLowerCase().includes(term) ||
                s.student_code?.toLowerCase().includes(term)
            );

            if (matched.length === 0) {
                setStudents([]);
                setSubjects([]);
                setLoading(false);
                return;
            }

            // 2. Cargar todas las asignaciones del año activo
            const assignmentsRes = await api.get(`/subject-assignments?academicYearId=${activeYear.id}`);
            let allAssignments = extractData(assignmentsRes.data);
            if (allAssignments.assignments) allAssignments = allAssignments.assignments;
            const electiveSubjects = allAssignments.filter(a => a.is_elective === 1);

            const studentsData = [];
            const subjectSet = new Map();

            for (const s of matched) {
                // 3. Obtener matrícula del año activo (findByStudent devuelve todos los años)
                const enrollmentsRes = await api.get(`/enrollments?studentId=${s.id}`);
                const allEnrollments = extractData(enrollmentsRes.data);
                // Filtrar por año activo
                const enrollment = allEnrollments.find(e => e.academic_year_id === activeYear.id);
                if (!enrollment) continue;

                const gradeId = enrollment.grade_id;

                // 4. Materias regulares del grado + electivas
                const regularSubjects = allAssignments.filter(a =>
                    a.is_elective !== 1 && a.grade_id === gradeId
                );
                [...regularSubjects, ...electiveSubjects].forEach(sub => {
                    if (!subjectSet.has(sub.id)) subjectSet.set(sub.id, sub);
                });

                // 5. Notas del estudiante filtradas por periodo
                const gradesRes = await api.get(`/grade-records/student-report?studentId=${s.id}&academicYearId=${activeYear.id}`);
                let gradeRecords = extractData(gradesRes.data);
                if (selectedPeriod) {
                    gradeRecords = gradeRecords.filter(g =>
                        g.period_id === parseInt(selectedPeriod) || g.periodId === parseInt(selectedPeriod)
                    );
                }

                const notasMap = {};
                const absencesMap = {};
                gradeRecords.forEach(g => {
                    const aid = g.subject_assignment_id || g.subjectAssignmentId;
                    if (aid) {
                        notasMap[aid] = { normal: g.normal_note, aptitudinal: g.aptitudinal_note };
                        absencesMap[aid] = g.absences;
                    }
                });

                studentsData.push({
                    id: s.id,
                    full_name: s.full_name,
                    student_code: s.student_code,
                    folio: enrollment.folio_number,
                    enrollment_id: enrollment.id,
                    grade_name: enrollment.grade_name || '',
                    notasMap,
                    absencesMap
                });
            }

            const allSubjects = Array.from(subjectSet.values());
            setSubjects(allSubjects);
            setStudents(studentsData);

            const initialGrades = {};
            const initialAbsences = {};
            studentsData.forEach(student => {
                allSubjects.forEach(subject => {
                    const key = `${student.id}_${subject.id}`;
                    initialGrades[key] = {
                        normal: student.notasMap[subject.id]?.normal ?? '',
                        aptitudinal: student.notasMap[subject.id]?.aptitudinal ?? ''
                    };
                    initialAbsences[key] = student.absencesMap[subject.id] ?? '';
                });
            });
            setGradesData(initialGrades);
            setAbsencesData(initialAbsences);
            setCurrentPage(1);
        } catch (error) {
            console.error('Error buscando estudiante:', error);
            showNotification('Error al buscar: ' + error.message, 'error');
            setStudents([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!selectedPeriod) {
            showNotification('Por favor seleccione un período', 'error');
            return;
        }
        if (!selectedGrade && !studentFilter.trim()) {
            showNotification('Seleccione un grado o escriba el nombre/código del estudiante', 'error');
            return;
        }

        setHasSearched(true);
        if (selectedGrade) {
            await loadDataByGrade();
        } else {
            await loadDataByStudent();
        }
    };

    const updateGrade = (studentId, subjectId, field, value) => {
        const key = `${studentId}_${subjectId}`;
        setGradesData(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                [field]: value === '' ? null : parseFloat(value)
            }
        }));
        setSaveSuccess(false);
    };

    const updateAbsences = (studentId, subjectId, value) => {
        const key = `${studentId}_${subjectId}`;
        setAbsencesData(prev => ({
            ...prev,
            [key]: value === '' ? null : parseInt(value)
        }));
        setSaveSuccess(false);
    };

    const saveAllGrades = async () => {
        if (!selectedPeriod) {
            showNotification('Seleccione un período', 'error');
            return;
        }

        setSaving(true);
        let savedCount = 0;

        for (const student of students) {
            for (const subject of [...subjects, ...electiveSubjectsList]) {
                const key = `${student.id}_${subject.id}`;
                const grade = gradesData[key];
                const absence = absencesData[key];
                
                const normal = grade?.normal !== undefined && grade?.normal !== null && grade?.normal !== '' ? grade.normal : null;
                const aptitudinal = grade?.aptitudinal !== undefined && grade?.aptitudinal !== null && grade?.aptitudinal !== '' ? grade.aptitudinal : null;
                const absenceValue = absence !== undefined && absence !== null && absence !== '' ? parseInt(absence) : null;
                
                if (normal === null && aptitudinal === null && absenceValue === null) continue;
                
                try {
                    await api.post('/grade-records/grades', {
                        enrollmentId: student.enrollment_id,
                        periodId: parseInt(selectedPeriod),
                        subjectAssignmentId: subject.id,
                        normalNote: normal,
                        aptitudinalNote: aptitudinal,
                        absences: absenceValue,
                        isElective: subject.is_elective === 1
                    });
                    savedCount++;
                } catch (err) {
                    console.error('Error guardando:', err);
                }
            }
        }

        if (savedCount > 0) {
            showNotification(`${savedCount} nota(s) guardada(s) correctamente`, 'success');
            setSaveSuccess(true);
            await loadDataByGrade();
        }
        setSaving(false);
    };

    const filteredStudents = selectedGrade && studentFilter.trim()
        ? students.filter(s =>
            s.full_name?.toLowerCase().includes(studentFilter.trim().toLowerCase()) ||
            s.student_code?.toLowerCase().includes(studentFilter.trim().toLowerCase())
          )
        : students;

    const indexOfLastStudent = currentPage * itemsPerPage;
    const indexOfFirstStudent = indexOfLastStudent - itemsPerPage;
    const currentStudents = filteredStudents.slice(indexOfFirstStudent, indexOfLastStudent);
    const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);

    const goToPage = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    useEffect(() => {
        loadGrades();
        loadPeriods();
    }, [activeYear, refreshKey]);

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

    const selectedGradeName = allGrades.find(g => g.id === parseInt(selectedGrade))?.name || '';

    return (
        <div className="max-w-full mx-auto px-6 py-6 overflow-x-auto">

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-6">
                {[{ id: 'consultas', label: 'Consultas' }, { id: 'auditorias', label: 'Auditorias' }].map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)}
                        className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                            activeTab === t.id
                                ? 'border-blue-700 text-blue-700'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {activeTab === 'auditorias' && <AuditPanel />}

            {activeTab === 'consultas' && <>
            {message && (
                <div className={`fixed top-5 right-5 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm ${
                    message.type === 'success' ? 'bg-emerald-500 text-white' : 
                    message.type === 'error' ? 'bg-rose-500 text-white' : 'bg-blue-500 text-white'
                }`}>
                    {message.text}
                </div>
            )}

            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                    Año lectivo activo: <strong>{activeYear.name}</strong>
                </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 card-hover p-6">
                <h2 className="text-[15px] font-semibold text-gray-800 mb-4">Gestion de notas</h2>
                <p className="text-sm text-gray-500 mb-4">Selecciona un grado especifico para ver y editar todas las notas</p>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Grado</label>
                        <select
                            value={selectedGrade}
                            onChange={(e) => { setSelectedGrade(e.target.value); setHasSearched(false); setStudents([]); }}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                        >
                            <option value="">Todos los grados</option>
                            {allGrades.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Periodo</label>
                        <select
                            value={selectedPeriod}
                            onChange={(e) => setSelectedPeriod(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                        >
                            <option value="">Seleccione un periodo</option>
                            {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                            Buscar estudiante
                            {selectedGrade && students.length > 0 && (
                                <span className="ml-1 font-normal text-gray-400">(filtra la tabla)</span>
                            )}
                        </label>
                        <input
                            type="text"
                            value={studentFilter}
                            onChange={(e) => { setStudentFilter(e.target.value); setCurrentPage(1); }}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !selectedGrade) handleSearch(); }}
                            placeholder="Nombre o código..."
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            className="w-full bg-blue-700 hover:bg-blue-800 text-white font-medium btn-press py-2 px-5 rounded-lg transition disabled:opacity-50 text-sm"
                        >
                            {loading ? 'Cargando...' : 'Consultar'}
                        </button>
                    </div>
                </div>

                {loading && <div className="text-center py-8">Cargando datos...</div>}

                {hasSearched && !loading && students.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-sm">
                        No se encontraron estudiantes
                    </div>
                )}

                {hasSearched && !loading && students.length > 0 && subjects.length > 0 && (
                    <div>
                        <div className="mb-3 flex justify-between items-center">
                            <div>
                                <span className="text-sm font-semibold text-gray-700">Materias académicas</span>
                                <span className="ml-2 text-sm text-gray-500">
                                    {filteredStudents.length} estudiantes · {subjects.length} materias
                                    {selectedGradeName && <span className="ml-1 text-blue-700">({selectedGradeName})</span>}
                                </span>
                            </div>
                            <button
                                onClick={saveAllGrades}
                                disabled={saving}
                                className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
                            >
                                {saving ? 'Guardando...' : 'Guardar todas las notas'}
                            </button>
                        </div>

                        <div className="overflow-x-auto mt-2">
                            <table className="w-full text-sm border border-gray-100 rounded-lg">
                                <thead className="bg-gray-50">
                                    <tr className="border-b border-gray-200">
                                        <th rowSpan="2" className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-r border-gray-100">Folio</th>
                                        <th rowSpan="2" className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-r border-gray-100">Estudiante</th>
                                        <th rowSpan="2" className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-r border-gray-100">Código</th>
                                        {!selectedGrade && <th rowSpan="2" className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-r border-gray-100">Grado</th>}
                                        {subjects.map(subject => (
                                            <th key={subject.id} colSpan="3" className="px-2 py-1.5 text-center text-xs font-medium text-gray-600 border-l border-gray-100">
                                                {subject.subject_name || subject.subjectName}
                                            </th>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-gray-200 bg-gray-50">
                                        {subjects.map(subject => (
                                            <Fragment key={subject.id}>
                                                <th className="px-1 py-1 text-center text-[10px] font-medium text-blue-500 border-l border-gray-100 w-16">Normal</th>
                                                <th className="px-1 py-1 text-center text-[10px] font-medium text-emerald-500 w-16">Actit.</th>
                                                <th className="px-1 py-1 text-center text-[10px] font-medium text-orange-400 w-14">Faltas</th>
                                            </Fragment>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {currentStudents.map(student => (
                                        <tr key={student.id} className="hover:bg-gray-50/50">
                                            <td className="px-3 py-2 text-center font-bold text-gray-700 border-r border-gray-100">{student.folio || '-'}</td>
                                            <td className="px-3 py-2 text-gray-700 border-r border-gray-100">{student.full_name}</td>
                                            <td className="px-3 py-2 text-gray-500 border-r border-gray-100">{student.student_code}</td>
                                            {!selectedGrade && <td className="px-3 py-2 text-gray-500 text-xs border-r border-gray-100">{student.grade_name || '-'}</td>}
                                            {subjects.map(subject => {
                                                const key = `${student.id}_${subject.id}`;
                                                return (
                                                    <Fragment key={subject.id}>
                                                        <td className="px-1 py-2 text-center border-l border-gray-100">
                                                            <input type="number" step="0.01" min="0" max="10"
                                                                value={gradesData[key]?.normal ?? ''}
                                                                onChange={e => updateGrade(student.id, subject.id, 'normal', e.target.value)}
                                                                className="w-14 px-1 py-1 border border-blue-100 rounded text-center text-xs focus:ring-1 focus:ring-blue-400 outline-none" />
                                                        </td>
                                                        <td className="px-1 py-2 text-center">
                                                            <input type="number" step="0.01" min="0" max="10"
                                                                value={gradesData[key]?.aptitudinal ?? ''}
                                                                onChange={e => updateGrade(student.id, subject.id, 'aptitudinal', e.target.value)}
                                                                className="w-14 px-1 py-1 border border-emerald-100 rounded text-center text-xs focus:ring-1 focus:ring-emerald-400 outline-none" />
                                                        </td>
                                                        <td className="px-1 py-2 text-center">
                                                            <input type="number" min="0"
                                                                value={absencesData[key] ?? ''}
                                                                onChange={e => updateAbsences(student.id, subject.id, e.target.value)}
                                                                className="w-12 px-1 py-1 border border-orange-100 rounded text-center text-xs focus:ring-1 focus:ring-orange-300 outline-none" />
                                                        </td>
                                                    </Fragment>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className="flex justify-center items-center gap-2 mt-4">
                                <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}
                                    className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40">Anterior</button>
                                <span className="text-xs text-gray-600">Página {currentPage} de {totalPages}</span>
                                <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}
                                    className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40">Siguiente</button>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Tabla electivas ───────────────────────────────────────── */}
                {hasSearched && !loading && students.length > 0 && electiveSubjectsList.length > 0 && (
                    <div className="mt-8">
                        <div className="mb-3 flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-700">Materias electivas</span>
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{electiveSubjectsList.length} materia(s)</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border border-gray-100 rounded-lg">
                                <thead className="bg-purple-50">
                                    <tr className="border-b border-purple-100">
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-r border-purple-100">Folio</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-r border-purple-100">Estudiante</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-r border-purple-100">Código</th>
                                        {electiveSubjectsList.map(subject => (
                                            <th key={subject.id} className="px-2 py-2 text-center text-xs font-medium text-purple-600 border-l border-purple-100">
                                                {subject.subject_name || subject.subjectName}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {currentStudents.map(student => (
                                        <tr key={student.id} className="hover:bg-purple-50/30">
                                            <td className="px-3 py-2 text-center font-bold text-gray-700 border-r border-purple-100">{student.folio || '-'}</td>
                                            <td className="px-3 py-2 text-gray-700 border-r border-purple-100">{student.full_name}</td>
                                            <td className="px-3 py-2 text-gray-500 border-r border-purple-100">{student.student_code}</td>
                                            {electiveSubjectsList.map(subject => {
                                                const key = `${student.id}_${subject.id}`;
                                                return (
                                                    <td key={subject.id} className="px-2 py-2 text-center border-l border-purple-100">
                                                        <input type="number" step="0.01" min="0" max="10"
                                                            value={gradesData[key]?.normal ?? ''}
                                                            onChange={e => updateGrade(student.id, subject.id, 'normal', e.target.value)}
                                                            className="w-16 px-2 py-1 border border-purple-200 rounded text-center text-xs focus:ring-1 focus:ring-purple-400 outline-none" />
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
            </>}
        </div>
    );
};

export default Queries;