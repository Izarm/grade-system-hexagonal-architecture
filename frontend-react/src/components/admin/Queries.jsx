import React, { useState, useEffect, useCallback, Fragment } from 'react';
import api from '../../api/client';
import { useActiveAcademicYear } from '../../hooks/useActiveAcademicYear';
import { useRefresh } from '../../contexts/RefreshContext';

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

    // Logro (reseña del director) editable por el admin, por período
    const [reviews, setReviews] = useState({}); // studentId -> texto
    const [logroStudent, setLogroStudent] = useState(null);
    const [logroText, setLogroText] = useState('');
    const [logroSaving, setLogroSaving] = useState(false);

    const openLogro = (student) => {
        setLogroStudent(student);
        setLogroText(reviews[student.id] || '');
    };
    const saveLogro = async () => {
        if (!logroStudent) return;
        setLogroSaving(true);
        try {
            await api.post('/head-teacher-reviews', {
                studentId: logroStudent.id,
                periodId: selectedPeriod ? parseInt(selectedPeriod) : null,
                academicYearId: activeYear.id,
                review: logroText,
            });
            setReviews(prev => ({ ...prev, [logroStudent.id]: logroText }));
            setLogroStudent(null);
            showNotification('Logro guardado correctamente');
        } catch (e) {
            showNotification('Error al guardar el logro', 'error');
        } finally {
            setLogroSaving(false);
        }
    };

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
        if (!activeYear) return;
        try {
            const res = await api.get(`/groups?academicYearId=${activeYear.id}`);
            const groupsData = extractData(res.data);
            // Construir lista de grados únicos con nombre de grupo
            const seen = new Set();
            const gradesList = [];
            groupsData.forEach(g => {
                if (!seen.has(g.grade_id)) {
                    seen.add(g.grade_id);
                    const displayName = g.name && g.name !== g.grade_name
                        ? `${g.grade_name} ${g.name}`
                        : g.grade_name;
                    gradesList.push({ id: g.grade_id, name: displayName });
                }
            });
            gradesList.sort((a, b) => parseInt(a.name) - parseInt(b.name));
            setAllGrades(gradesList);
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

            // Cargar logros (reseñas del director) del período seleccionado
            try {
                const revParams = new URLSearchParams({ academicYearId: activeYear.id });
                if (selectedPeriod) revParams.append('periodId', selectedPeriod);
                const revRes = await api.get(`/head-teacher-reviews?${revParams}`);
                const revData = extractData(revRes.data);
                const revMap = {};
                revData.forEach(r => { revMap[r.student_id] = r.review; });
                setReviews(revMap);
            } catch { setReviews({}); }

            const initialGrades = {};
            const initialAbsences = {};
            const allSubjectsForInit = [...regularSubjects, ...electiveSubjects];
            studentsData.forEach(student => {
                allSubjectsForInit.forEach(subject => {
                    const key = `${student.id}_${subject.id}`;
                    const n1 = parseNote1(student.notasMap[subject.id]?.normal);
                    const a1 = parseNote1(student.notasMap[subject.id]?.aptitudinal);
                    initialGrades[key] = {
                        normal: n1 !== null ? String(n1) : '',
                        aptitudinal: a1 !== null ? String(a1) : ''
                    };
                    initialAbsences[key] = student.absencesMap[subject.id] !== undefined && student.absencesMap[subject.id] !== null
                        ? String(student.absencesMap[subject.id]) : '';
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
                    const n1 = parseNote1(student.notasMap[subject.id]?.normal);
                    const a1 = parseNote1(student.notasMap[subject.id]?.aptitudinal);
                    initialGrades[key] = {
                        normal: n1 !== null ? String(n1) : '',
                        aptitudinal: a1 !== null ? String(a1) : ''
                    };
                    initialAbsences[key] = student.absencesMap[subject.id] !== undefined && student.absencesMap[subject.id] !== null
                        ? String(student.absencesMap[subject.id]) : '';
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

    // Solo dígitos y un punto decimal, máximo 1 decimal, tope 10
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

    const parseNote1 = (v) => {
        if (v === undefined || v === null || v === '') return null;
        const n = parseFloat(v);
        if (isNaN(n)) return null;
        return Math.round(n * 10) / 10;
    };

    const updateGrade = (studentId, subjectId, field, value) => {
        const key = `${studentId}_${subjectId}`;
        setGradesData(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                [field]: sanitizeNote(value)
            }
        }));
        setSaveSuccess(false);
    };

    const updateAbsences = (studentId, subjectId, value) => {
        const key = `${studentId}_${subjectId}`;
        setAbsencesData(prev => ({
            ...prev,
            [key]: (value ?? '').toString().replace(/[^0-9]/g, '')
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
                
                const normal = parseNote1(grade?.normal);
                const aptitudinal = parseNote1(grade?.aptitudinal);
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

            {activeTab === 'consultas' && <>
            {message && (
                <div className={`fixed top-5 right-5 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm ${
                    message.type === 'success' ? 'bg-emerald-500 text-white' :
                    message.type === 'error' ? 'bg-rose-500 text-white' : 'bg-blue-500 text-white'
                }`}>
                    {message.text}
                </div>
            )}

            {/* Modal para editar/agregar el logro del estudiante */}
            {logroStudent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg modal-enter max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-[15px] font-semibold text-gray-800">Logro del estudiante</h3>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {logroStudent.full_name}
                                    {periods.find(p => p.id.toString() === selectedPeriod)
                                        ? ` · ${periods.find(p => p.id.toString() === selectedPeriod).name}` : ''}
                                </p>
                            </div>
                            <button onClick={() => setLogroStudent(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                        </div>
                        <div className="p-6">
                            <textarea
                                rows={6}
                                value={logroText}
                                onChange={e => setLogroText(e.target.value)}
                                placeholder="Escribe el logro / reseña del estudiante para este período..."
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                                autoFocus
                            />
                            <div className="flex justify-end gap-3 mt-4">
                                <button onClick={() => setLogroStudent(null)} disabled={logroSaving}
                                    className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                                    Cancelar
                                </button>
                                <button onClick={saveLogro} disabled={logroSaving}
                                    className="px-4 py-2 text-sm bg-blue-700 hover:bg-blue-800 text-white rounded-lg transition disabled:opacity-50 font-medium">
                                    {logroSaving ? 'Guardando...' : 'Guardar logro'}
                                </button>
                            </div>
                        </div>
                    </div>
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
                                        <th rowSpan="2" className="px-3 py-2 text-center text-xs font-medium text-gray-500 border-r border-gray-100">Logro</th>
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
                                            <td className="px-2 py-2 text-center border-r border-gray-100">
                                                <button type="button" onClick={() => openLogro(student)}
                                                    title={reviews[student.id] ? 'Editar logro' : 'Agregar logro'}
                                                    className={`text-xs font-medium px-2 py-1 rounded-lg transition ${reviews[student.id] ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                                                    {reviews[student.id] ? 'Ver / editar' : 'Agregar'}
                                                </button>
                                            </td>
                                            {subjects.map(subject => {
                                                const key = `${student.id}_${subject.id}`;
                                                return (
                                                    <Fragment key={subject.id}>
                                                        <td className="px-1 py-2 text-center border-l border-gray-100">
                                                            <input type="text" inputMode="decimal"
                                                                value={gradesData[key]?.normal ?? ''}
                                                                onChange={e => updateGrade(student.id, subject.id, 'normal', e.target.value)}
                                                                className="w-14 px-1 py-1 border border-blue-100 rounded text-center text-xs focus:ring-1 focus:ring-blue-400 outline-none" />
                                                        </td>
                                                        <td className="px-1 py-2 text-center">
                                                            <input type="text" inputMode="decimal"
                                                                value={gradesData[key]?.aptitudinal ?? ''}
                                                                onChange={e => updateGrade(student.id, subject.id, 'aptitudinal', e.target.value)}
                                                                className="w-14 px-1 py-1 border border-emerald-100 rounded text-center text-xs focus:ring-1 focus:ring-emerald-400 outline-none" />
                                                        </td>
                                                        <td className="px-1 py-2 text-center">
                                                            <input type="text" inputMode="numeric"
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
                                                        <input type="text" inputMode="decimal"
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