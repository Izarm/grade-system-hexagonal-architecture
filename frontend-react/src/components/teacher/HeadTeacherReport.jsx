import { useState, useEffect, Fragment } from 'react';
import api from '../../api/client';
import { useActiveAcademicYear } from '../../hooks/useActiveAcademicYear';
import { useRefresh } from '../../contexts/RefreshContext';

const HeadTeacherReport = () => {
    const { refreshKey, refresh } = useRefresh();
    const [grades, setGrades] = useState([]);
    const [periods, setPeriods] = useState([]);
    const [selectedGrade, setSelectedGrade] = useState('');
    const [selectedPeriod, setSelectedPeriod] = useState('');
    const [students, setStudents] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [reviews, setReviews] = useState({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [currentStudent, setCurrentStudent] = useState(null);
    const [currentReview, setCurrentReview] = useState('');

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

    const getGradeNumber = (gradeName) => {
        const match = gradeName.match(/(\d+)/);
        return match ? parseInt(match[0]) : 999;
    };

    const getGradeLetter = (gradeName) => {
        const match = gradeName.match(/[A-Z]+$/);
        return match ? match[0] : '';
    };

    const sortGrades = (gradesArray) => {
        return [...gradesArray].sort((a, b) => {
            const numA = getGradeNumber(a.name);
            const numB = getGradeNumber(b.name);
            if (numA !== numB) return numA - numB;
            const letterA = getGradeLetter(a.name);
            const letterB = getGradeLetter(b.name);
            return letterA.localeCompare(letterB);
        });
    };

    const loadGrades = async () => {
        try {
            const res = await api.get('/grades');
            const gradesData = extractData(res.data);
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const myGrades = gradesData.filter(g => g.head_teacher_id === user.id);
            const sortedGrades = sortGrades(myGrades);
            setGrades(sortedGrades);
        } catch (error) {
            console.error('Error cargando grados:', error);
            setGrades([]);
        }
    };

    const isFinalReport = selectedPeriod === 'final';

    const loadPeriods = async () => {
        if (!activeYear) return;
        try {
            const res = await api.get(`/periods?academicYearId=${activeYear.id}`);
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

    const loadReviews = async (studentIds, periodId) => {
        if (!periodId || studentIds.length === 0) return;
        
        try {
            const reviewsData = {};
            for (const studentId of studentIds) {
                const pidParam = periodId === 'final' ? '' : `&periodId=${periodId}`;
            const finalParam = periodId === 'final' ? '&isFinal=true' : '';
            const res = await api.get(`/head-teacher-reviews?studentId=${studentId}${pidParam}${finalParam}&academicYearId=${activeYear.id}`);
                const data = extractData(res.data);
                if (data.length > 0) {
                    reviewsData[studentId] = data[0].review || '';
                } else {
                    reviewsData[studentId] = '';
                }
            }
            setReviews(reviewsData);
        } catch (error) {
            console.error('Error cargando reseñas:', error);
        }
    };

    const loadSubjectsAndStudents = async () => {
        if (!selectedGrade) {
            showNotification('Seleccione un grado', 'error');
            return;
        }

        if (!activeYear) {
            showNotification('No hay año lectivo activo', 'error');
            return;
        }

        setLoading(true);
        try {
            const groupsRes = await api.get(`/groups/by-grade/${selectedGrade}`);
            const groups = extractData(groupsRes.data);
            
            if (groups.length === 0) {
                setStudents([]);
                setLoading(false);
                return;
            }

            const groupIds = groups.map(g => g.id);

            // Use dedicated endpoint that returns ALL subjects for the grade (no teacher filter)
            const assignmentsRes = await api.get(
                `/subject-assignments/by-grade/${selectedGrade}?academicYearId=${activeYear.id}`
            );
            let allAssignments = extractData(assignmentsRes.data);

            // Deduplicate by subject_id — one column per subject
            const subjectMap = new Map();
            for (const a of allAssignments) {
                if (!subjectMap.has(a.subject_id)) subjectMap.set(a.subject_id, a);
            }
            // Sort: academic first, then elective
            const allSubjects = [...subjectMap.values()].sort((a, b) => {
                if (a.is_elective === b.is_elective) return (a.subject_name || '').localeCompare(b.subject_name || '');
                return (a.is_elective === 1 ? 1 : 0) - (b.is_elective === 1 ? 1 : 0);
            });
            setSubjects(allSubjects);
            
            let allEnrollments = [];
            for (const groupId of groupIds) {
                const enrollmentsRes = await api.get(`/enrollments?groupId=${groupId}&academicYearId=${activeYear.id}`);
                const enrollments = extractData(enrollmentsRes.data);
                allEnrollments = [...allEnrollments, ...enrollments];
            }
            
            const studentsData = await Promise.all(allEnrollments.map(async e => {
                const studentRes = await api.get(`/students/${e.student_id}`);
                const studentData = studentRes.data;
                
                const gradesRes = await api.get(`/grade-records/student-report?studentId=${e.student_id}&academicYearId=${activeYear.id}`);
                let allGrades = extractData(gradesRes.data);

                const notasMap = {};
                if (isFinalReport) {
                    // Group by subject and average across all periods
                    const bySubject = {};
                    allGrades.forEach(g => {
                        const subjectId = g.subject_id || g.subjectId;
                        if (!bySubject[subjectId]) bySubject[subjectId] = { normals: [], aptitudinals: [], absences: [] };
                        if (g.normal_note !== null && g.normal_note !== undefined) bySubject[subjectId].normals.push(parseFloat(g.normal_note));
                        if (g.aptitudinal_note !== null && g.aptitudinal_note !== undefined) bySubject[subjectId].aptitudinals.push(parseFloat(g.aptitudinal_note));
                        if (g.absences !== null && g.absences !== undefined) bySubject[subjectId].absences.push(parseInt(g.absences));
                    });
                    Object.entries(bySubject).forEach(([subjectId, data]) => {
                        const avg = arr => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : null;
                        notasMap[subjectId] = {
                            normal: avg(data.normals),
                            aptitudinal: avg(data.aptitudinals),
                            absences: data.absences.length ? data.absences.reduce((a, b) => a + b, 0) : null,
                            isFinal: true
                        };
                    });
                } else {
                    const filtered = selectedPeriod
                        ? allGrades.filter(g => g.period_id === parseInt(selectedPeriod) || g.periodId === parseInt(selectedPeriod))
                        : allGrades;
                    filtered.forEach(g => {
                        const subjectId = g.subject_id || g.subjectId;
                        notasMap[subjectId] = {
                            normal: g.normal_note,
                            aptitudinal: g.aptitudinal_note,
                            absences: g.absences,
                        };
                    });
                }
                
                return {
                    id: e.student_id,
                    full_name: studentData.full_name,
                    student_code: studentData.student_code,
                    folio: e.folio_number,
                    notasMap: notasMap
                };
            }));
            
            studentsData.sort((a, b) => {
                if (a.folio && b.folio) return a.folio - b.folio;
                return a.full_name.localeCompare(b.full_name);
            });
            
            setStudents(studentsData);
            
            const periodForReviews = isFinalReport ? 'final' : selectedPeriod;
            if (periodForReviews) {
                await loadReviews(studentsData.map(s => s.id), periodForReviews);
            }
            
        } catch (error) {
            console.error('Error cargando datos:', error);
            showNotification('Error al cargar los datos', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveReview = async () => {
        if (!currentStudent || !selectedPeriod) return;

        setSaving(true);
        const periodIdToSave = selectedPeriod === 'final' ? null : parseInt(selectedPeriod);
        try {
            await api.post('/head-teacher-reviews', {
                studentId: currentStudent.id,
                periodId: periodIdToSave,
                academicYearId: activeYear.id,
                review: currentReview
            });
            
            setReviews(prev => ({
                ...prev,
                [currentStudent.id]: currentReview
            }));
            
            showNotification('Reseña guardada correctamente');
            setShowReviewModal(false);
            setCurrentStudent(null);
            setCurrentReview('');
            refresh();
        } catch (error) {
            console.error('Error guardando reseña:', error);
            showNotification('Error al guardar la reseña', 'error');
        } finally {
            setSaving(false);
        }
    };

    const openReviewModal = (student) => {
        setCurrentStudent(student);
        setCurrentReview(reviews[student.id] || '');
        setShowReviewModal(true);
    };

    useEffect(() => {
        loadGrades();
        loadPeriods();
    }, [activeYear, refreshKey]);

    useEffect(() => {
        if (selectedGrade && activeYear) {
            loadSubjectsAndStudents();
        }
    }, [selectedGrade, selectedPeriod, activeYear, refreshKey]);

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

    const formatValue = (value, isAvg = false) => {
        if (value === null || value === undefined) return '-';
        if (typeof value === 'number') return isAvg ? value.toFixed(2) : value;
        return value;
    };

    return (
        <div className="max-w-full mx-auto px-6 py-6 overflow-x-auto">
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
                <h2 className="text-[15px] font-semibold text-gray-800 mb-4">Reporte por Grado</h2>
                <p className="text-sm text-gray-500 mb-4">Selecciona el grado del cual eres director para ver los estudiantes y sus notas</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Grado</label>
                        <select
                            value={selectedGrade}
                            onChange={(e) => setSelectedGrade(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                        >
                            <option value="">Seleccione un grado</option>
                            {grades.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Período</label>
                        <select
                            value={selectedPeriod}
                            onChange={(e) => setSelectedPeriod(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                        >
                            <option value="">Seleccione un período</option>
                            {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            <option value="final">Reporte Final (promedio todos los períodos)</option>
                        </select>
                    </div>
                </div>

                {loading && <div className="text-center py-8">Cargando datos...</div>}

                {!loading && selectedGrade && students.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-sm">
                        No hay estudiantes matriculados en este grado
                    </div>
                )}

                {isFinalReport && selectedGrade && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                        <span className="text-amber-600 font-semibold text-sm">Reporte Final</span>
                        <span className="text-amber-700 text-xs">— Promedio de todos los períodos. La reseña aquí es la nota final del año.</span>
                    </div>
                )}

                {!loading && selectedGrade && students.length > 0 && subjects.length > 0 && (
                    <>
                        <div className="mb-4 flex justify-end">
                            <button
                                onClick={() => {
                                    if (selectedPeriod) {
                                        loadSubjectsAndStudents();
                                    } else {
                                        showNotification('Seleccione un período', 'error');
                                    }
                                }}
                                disabled={loading}
                                className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                            >
                                Actualizar
                            </button>
                        </div>

                        <div className="overflow-x-auto mt-2">
                            <table className="w-full text-sm border border-gray-100 rounded-lg">
                                <thead className="bg-gray-50">
                                    <tr className="border-b">
                                        <th rowSpan="2" className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase border">Folio</th>
                                        <th rowSpan="2" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase border">Estudiante</th>
                                        <th rowSpan="2" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase border">Código</th>
                                        {subjects.map(subject => {
                                            const isElective = subject.is_elective === 1;
                                            return (
                                                <th key={subject.id} colSpan={isElective ? 2 : 3} className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase border">
                                                    {subject.subject_name || subject.subjectName} {isElective && <span className="text-purple-500">(E)</span>}
                                                </th>
                                            );
                                        })}
                                        <th rowSpan="2" className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase border">Reseña</th>
                                    </tr>
                                    <tr className="border-b">
                                        {subjects.map(subject => {
                                            const isElective = subject.is_elective === 1;
                                            return (
                                                <Fragment key={`${subject.id}-header`}>
                                                    <th className="px-2 py-1 text-center text-xs font-medium text-gray-400 border">Nota</th>
                                                    {!isElective && <th className="px-2 py-1 text-center text-xs font-medium text-gray-400 border">Apt.</th>}
                                                    <th className="px-2 py-1 text-center text-xs font-medium text-gray-400 border">Faltas</th>
                                                </Fragment>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {students.map((student) => {
                                        const studentReview = reviews[student.id] || '';
                                        return (
                                            <tr key={student.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-3 py-2 text-center font-bold text-gray-700 border">{student.folio || '-'}</td>
                                                <td className="px-3 py-2 text-gray-700 border">{student.full_name}</td>
                                                <td className="px-3 py-2 text-gray-500 border">{student.student_code}</td>
                                                {subjects.map((subject) => {
                                                    const nota = student.notasMap[subject.subject_id || subject.subjectId];
                                                    const normal = nota?.normal;
                                                    const aptitudinal = nota?.aptitudinal;
                                                    const absences = nota?.absences;
                                                    return (
                                                        <Fragment key={`${student.id}-${subject.id}`}>
                                                            <td className="px-2 py-2 text-center border font-medium">{formatValue(normal, isFinalReport)}</td>
                                                            {!subject.is_elective && <td className="px-2 py-2 text-center border">{formatValue(aptitudinal, isFinalReport)}</td>}
                                                            <td className="px-2 py-2 text-center border">{formatValue(absences)}</td>
                                                        </Fragment>
                                                    );
                                                })}
                                                <td className="px-3 py-2 text-center border">
                                                    <button
                                                        onClick={() => openReviewModal(student)}
                                                        className={`text-xs font-medium transition ${
                                                            studentReview
                                                                ? 'text-green-600 hover:text-green-700'
                                                                : 'text-blue-700 hover:text-blue-700'
                                                        }`}
                                                    >
                                                        {studentReview ? 'Editar reseña' : 'Agregar reseña'}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {/* Modal para reseña */}
            {showReviewModal && currentStudent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden">
                        <div className="flex justify-between items-center px-5 py-3 border-b border-gray-100 bg-gray-50">
                            <h3 className="text-[15px] font-semibold text-gray-800">
                                Reseña para {currentStudent.full_name}
                            </h3>
                            <button 
                                onClick={() => setShowReviewModal(false)}
                                className="text-gray-400 hover:text-gray-600 text-xl"
                            >
                                &times;
                            </button>
                        </div>
                        
                        <div className="p-5">
                            <textarea
                                value={currentReview}
                                onChange={(e) => setCurrentReview(e.target.value)}
                                placeholder="Escriba aquí la reseña u observación para este estudiante..."
                                rows={6}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm resize-none"
                            />
                            <p className="text-xs text-gray-400 mt-2">
                                Esta reseña será visible en el reporte del estudiante.
                            </p>
                        </div>
                        
                        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
                            <button
                                onClick={() => setShowReviewModal(false)}
                                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-1.5 rounded-lg text-sm transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveReview}
                                disabled={saving}
                                className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50"
                            >
                                {saving ? 'Guardando...' : 'Guardar reseña'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HeadTeacherReport;