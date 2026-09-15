import { useState, useEffect } from 'react';
import api from '../../api/client';
import { compararPorApellidos } from '../../utils/nombres';
import ConfirmDialog from '../common/ConfirmDialog';
import { useRefresh } from '../../contexts/RefreshContext';
import { useActiveAcademicYear } from '../../hooks/useActiveAcademicYear';

const Grades = () => {
    const { refreshKey, refresh } = useRefresh();
    const { activeYear } = useActiveAcademicYear();
    const [grades, setGrades] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [form, setForm] = useState({ name: '', students: [] });
    const [newStudentName, setNewStudentName] = useState('');
    const [newStudentCode, setNewStudentCode] = useState('');
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [gradeToDelete, setGradeToDelete] = useState(null);
    const [showStudentsModal, setShowStudentsModal] = useState(false);
    const [selectedGrade, setSelectedGrade] = useState(null);
    const [selectedGradeId, setSelectedGradeId] = useState(null);
    // El modal abre UN curso concreto (1° A), no el grado completo.
    // Se guarda para que los listados salgan solo de ese curso.
    const [selectedGroupId, setSelectedGroupId] = useState(null);
    const [studentsInGrade, setStudentsInGrade] = useState([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [assigningHeadTeacher, setAssigningHeadTeacher] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [activeTab, setActiveTab] = useState('create');
    const [searchTeacher, setSearchTeacher] = useState('');
    const [openSelect, setOpenSelect] = useState(null);
    const [showConfirmStudent, setShowConfirmStudent] = useState(false);
    const [enrollmentToDelete, setEnrollmentToDelete] = useState(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentGrades = grades.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(grades.length / itemsPerPage);

    const sortGrades = (gradesArray) => {
        return [...gradesArray].sort((a, b) => {
            const numA = parseInt(a.name.split('°')[0]);
            const numB = parseInt(b.name.split('°')[0]);
            if (numA !== numB) return numA - numB;
            const letterA = a.name.split('°')[1] || '';
            const letterB = b.name.split('°')[1] || '';
            const order = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8, 'I': 9, 'J': 10 };
            const orderA = order[letterA.toUpperCase()] || 99;
            const orderB = order[letterB.toUpperCase()] || 99;
            return orderA - orderB;
        });
    };

    const loadTeachers = async () => {
        try {
            const res = await api.get('/users');
            const usersData = Array.isArray(res.data) ? res.data : (res.data.data || []);
            // un grupo puede estar dirigido por un docente o por personal administrativo
            // (p. ej. una secretaria); no filtrar por rol para no perder ese nombre.
            setTeachers(usersData);
        } catch (error) {
            console.error('Error cargando docentes:', error);
            setTeachers([]);
        }
    };

    const loadGradesWithCount = async (resetPage = true) => {
        if (!activeYear) return;
        setLoading(true);
        try {
            // 1. Cargar grupos (ya incluye grade_name desde el JOIN en el backend)
            const groupsRes = await api.get(`/groups?academicYearId=${activeYear.id}`);
            const groups = Array.isArray(groupsRes.data)
                ? groupsRes.data
                : (groupsRes.data?.data || []);

            if (groups.length === 0) {
                setGrades([]);
                return;
            }

            // head_teacher_id ya viene en cada grupo desde el API

            // 3. Cargar matrículas para contar por grupo (tolerante a fallos)
            let countByGroup = {};
            try {
                const enrRes = await api.get(`/enrollments?academicYearId=${activeYear.id}`);
                const enrollments = Array.isArray(enrRes.data)
                    ? enrRes.data
                    : (enrRes.data?.data || []);
                enrollments.forEach(e => {
                    const gid = e.group_id ?? e.groupId;
                    if (gid) countByGroup[gid] = (countByGroup[gid] || 0) + 1;
                });
            } catch (_) { /* no bloquea si falla */ }

            // 4. Construir una fila por grupo: "6° A", "7° B", etc.
            // El SQL ya ordena por CAST(grade.name AS UNSIGNED) ASC + letra grupo ASC
            // → orden: Transición/Jardín/etc (CAST=0) primero, luego 1°A,1°B,2°A,2°B,...,11°B
            // Solo necesitamos mover los grados especiales (sin número) al final.
            const toRow = (group) => {
                const gradeName   = group.grade_name || '';
                const groupLetter = group.name || '';
                const displayName = gradeName && groupLetter && groupLetter !== gradeName
                    ? `${gradeName} ${groupLetter}`
                    : gradeName || groupLetter;
                const isNumbered = !isNaN(parseInt(gradeName));
                return {
                    id:              group.grade_id,
                    group_id:        group.id,
                    name:            displayName,
                    displayName,
                    head_teacher_id: group.head_teacher_id ?? null,
                    studentCount:    countByGroup[group.id] || 0,
                    _isNumbered:     isNumbered,
                };
            };

            // Grados numerados (SQL ya los ordena: 1°A, 1°B, 2°A, 2°B… 11°B)
            const numbered = groups.filter(g => !isNaN(parseInt(g.grade_name))).map(toRow);
            // Grados especiales (Transición, Jardín, Pre-Jardín, Materno)
            const special  = groups.filter(g =>  isNaN(parseInt(g.grade_name))).map(toRow);

            setGrades([...numbered, ...special]);
            if (resetPage) setCurrentPage(1);
        } catch (error) {
            console.error('Error cargando grados:', error);
            setGrades([]);
        } finally {
            setLoading(false);
        }
    };

    // ---- Listado de estudiantes del grado (PDF / Excel) ----
    // Una sección por cada curso, con folio, código, apellidos y nombres,
    // director de curso y año lectivo.
    const [descargandoListado, setDescargandoListado] = useState(null);

    // `todosLosGrados` pide el año lectivo completo (un curso por hoja/sección).
    // Sin esa bandera, se genera solo el curso abierto en el modal.
    const descargarListado = async (formato, todosLosGrados = false) => {
        if (!todosLosGrados && !selectedGradeId && !selectedGroupId) return;
        setDescargandoListado(todosLosGrados ? `todos-${formato}` : formato);
        try {
            const res = await api.get('/academic-years');
            const años = Array.isArray(res.data) ? res.data : (res.data.data || []);
            const activo = años.find(a => a.active === 1 || a.active === true);
            if (!activo) {
                setMessage({ type: 'error', text: 'No hay un año lectivo activo' });
                setTimeout(() => setMessage(null), 3000);
                return;
            }

            // Dos listados distintos:
            //   enumerado  -> N°, código y nombre (lista de clase)
            //   datos      -> todos los datos del estudiante, en Word o Excel
            const esDatos = formato === 'datos-word' || formato === 'datos-excel';
            const ruta = esDatos ? '/reports/student-data-sheet' : '/reports/student-listing';
            const extra = esDatos
                ? (formato === 'datos-word' ? '&format=word' : '&format=excel')
                : (formato === 'excel' ? '&format=excel' : formato === 'ver' ? '&format=html' : '');
            // Se pide por curso (groupId). Solo se cae al grado completo si por
            // alguna razón no se conoce el curso abierto. Sin ninguno de los dos,
            // el backend devuelve todos los cursos del año.
            const alcance = todosLosGrados
                ? ''
                : selectedGroupId
                    ? `&groupId=${selectedGroupId}`
                    : `&gradeId=${selectedGradeId}`;
            const url = `${ruta}?academicYearId=${activo.id}${alcance}${extra}`;

            const token = localStorage.getItem('token');
            const respuesta = await fetch(`${api.defaults.baseURL}${url}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!respuesta.ok) {
                const err = await respuesta.json().catch(() => ({}));
                throw new Error(err.message || 'No se pudo generar el listado');
            }

            // "Ver": se abre la vista previa en una pestaña nueva, con botón de imprimir
            if (formato === 'ver') {
                const html = await respuesta.text();
                const ventana = window.open('', '_blank');
                if (!ventana) {
                    setMessage({ type: 'error', text: 'El navegador bloqueó la ventana emergente. Permítela para ver el listado.' });
                    setTimeout(() => setMessage(null), 5000);
                    return;
                }
                ventana.document.write(html);
                ventana.document.close();
                return;
            }

            const cabecera = respuesta.headers.get('Content-Disposition') || '';
            const m = cabecera.match(/filename="?([^"]+)"?/);
            const nombre = m ? m[1] : `listado.${formato === 'excel' ? 'xlsx' : 'pdf'}`;

            const blob = await respuesta.blob();
            const a = document.createElement('a');
            a.href = window.URL.createObjectURL(blob);
            a.setAttribute('download', nombre);
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(a.href);
        } catch (error) {
            setMessage({ type: 'error', text: error.message || 'No se pudo generar el listado' });
            setTimeout(() => setMessage(null), 4000);
        } finally {
            setDescargandoListado(null);
        }
    };

    const loadStudentsByGrade = async (gradeId, gradeName, groupId) => {
        setLoadingStudents(true);
        setSelectedGrade(gradeName);
        setSelectedGradeId(gradeId);
        setSelectedGroupId(groupId ?? null);

        try {
            const yearParam = activeYear ? `?academicYearId=${activeYear.id}` : '';
            const enrollmentsRes = await api.get(`/enrollments${yearParam}`);
            let enrollments = Array.isArray(enrollmentsRes.data) ? enrollmentsRes.data : (enrollmentsRes.data.data || []);

            // Filtrar por el grupo concreto (tolerante a snake_case y camelCase)
            const gradeEnrollments = groupId
                ? enrollments.filter(e => (e.group_id ?? e.groupId) === groupId)
                : enrollments.filter(e => (e.grade_id ?? e.gradeId) === gradeId);

            const students = [];
            for (const e of gradeEnrollments) {
                try {
                    const studentRes = await api.get(`/students/${e.student_id}`);
                    const studentData = studentRes.data;
                    students.push({
                        enrollmentId: e.id,
                        id: e.student_id,
                        full_name: studentData.full_name,
                        student_code: studentData.student_code,
                        folio_number: e.folio_number
                    });
                } catch (err) {
                    console.error('Error cargando estudiante:', e.student_id, err);
                }
            }

            // En Grados la lista va en orden alfabetico por apellidos y se
            // numera 1, 2, 3... reiniciando en cada curso. El folio no se usa
            // aqui: es continuo por seccion y preescolar no lo lleva.
            // El folio sigue visible en Matriculas y en el libro de calificaciones.
            students.sort(compararPorApellidos);

            setStudentsInGrade(students);
            setShowStudentsModal(true);
        } catch (error) {
            console.error('Error cargando estudiantes:', error);
            setMessage({ type: 'error', text: 'Error al cargar los estudiantes' });
            setTimeout(() => setMessage(null), 3000);
        } finally {
            setLoadingStudents(false);
        }
    };

    const addStudentToList = () => {
        if (!newStudentName.trim()) {
            setMessage({ type: 'error', text: 'El nombre del estudiante es obligatorio' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }

        setForm(prev => ({
            ...prev,
            students: [...prev.students, { fullName: newStudentName.trim() }]
        }));
        setNewStudentName('');
    };

    const removeStudentFromList = (index) => {
        setForm(prev => ({
            ...prev,
            students: prev.students.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.name) {
            setMessage({ type: 'error', text: 'Nombre del grado obligatorio' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            await api.post('/grades', {
                name: form.name,
                students: form.students
            });

            setMessage({ type: 'success', text: `Grado "${form.name}" creado` });
            setForm({ name: '', students: [] });
            loadGradesWithCount();
        } catch (err) {
            console.error('Error al crear grado:', err);
            setMessage({ type: 'error', text: err.response?.data?.message || 'Error al crear grado' });
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const addStudentToGrade = async () => {
        if (!newStudentName.trim()) {
            setMessage({ type: 'error', text: 'El nombre del estudiante es obligatorio' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }

        setLoading(true);
        try {
            // Crear el estudiante — el código se genera automáticamente en el backend
            let studentId;
            const studentRes = await api.post('/students', {
                fullName: newStudentName.trim()
            });
            studentId = studentRes.data.id;

            const yearsRes = await api.get('/academic-years');
            const yearsData = yearsRes.data.data || yearsRes.data;
            const activeYear = yearsData.find(y => y.active === 1);

            if (!activeYear) {
                throw new Error('No hay año lectivo activo');
            }

            // Obtener el group_id del grupo actualmente seleccionado
            const currentRow = grades.find(g => g.id === selectedGradeId && g.displayName === selectedGrade);
            const groupId = currentRow?.group_id;

            if (!groupId) {
                setMessage({ type: 'error', text: 'No se pudo determinar el grupo' });
                setLoading(false);
                return;
            }

            await api.post('/enrollments', {
                studentId,
                groupId,
                academicYearId: activeYear.id
            });

            setMessage({ type: 'success', text: 'Estudiante agregado y matriculado' });
            setNewStudentName('');
            await loadStudentsByGrade(selectedGradeId, selectedGrade, grades.find(g => g.id === selectedGradeId && g.displayName === selectedGrade)?.group_id);
            loadGradesWithCount(false);
        } catch (error) {
            console.error('Error agregando estudiante:', error);
            setMessage({ type: 'error', text: error.response?.data?.message || 'Error al agregar' });
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const updateStudent = async () => {
        if (!editingStudent) return;

        setLoading(true);
        try {
            await api.put(`/students/${editingStudent.id}`, {
                lastName: (editingStudent.last_name ?? editingStudent.lastName ?? '').trim(),
                firstName: (editingStudent.first_name ?? editingStudent.firstName ?? '').trim(),
            });
            setMessage({ type: 'success', text: 'Estudiante actualizado' });
            setEditingStudent(null);
            await loadStudentsByGrade(selectedGradeId, selectedGrade, grades.find(g => g.id === selectedGradeId && g.displayName === selectedGrade)?.group_id);
            loadGradesWithCount(false);
        } catch (error) {
            console.error('Error actualizando estudiante:', error);
            setMessage({ type: 'error', text: 'Error al actualizar' });
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const deleteStudentFromGrade = (enrollmentId) => {
        setEnrollmentToDelete(enrollmentId);
        setShowConfirmStudent(true);
    };

    const confirmDeleteStudent = async () => {
        if (enrollmentToDelete) {
            setLoading(true);
            try {
                await api.delete(`/enrollments/${enrollmentToDelete}`);
                setMessage({ type: 'success', text: 'Estudiante eliminado' });
                await loadStudentsByGrade(selectedGradeId, selectedGrade, grades.find(g => g.id === selectedGradeId && g.displayName === selectedGrade)?.group_id);
                loadGradesWithCount(false);
            } catch (error) {
                console.error('Error eliminando estudiante:', error);
                setMessage({ type: 'error', text: 'Error al eliminar' });
            } finally {
                setLoading(false);
                setTimeout(() => setMessage(null), 3000);
            }
        }
        setShowConfirmStudent(false);
        setEnrollmentToDelete(null);
    };

    const cancelDeleteStudent = () => {
        setShowConfirmStudent(false);
        setEnrollmentToDelete(null);
    };

    const assignHeadTeacher = async (groupId, teacherId) => {
        setAssigningHeadTeacher(true);
        try {
            await api.put(`/groups/${groupId}/head-teacher`, { teacherId: teacherId || null });
            setMessage({ type: 'success', text: 'Director asignado' });
            loadGradesWithCount(false);
            setOpenSelect(null);
        } catch (error) {
            console.error('Error asignando director:', error);
            setMessage({ type: 'error', text: 'Error al asignar' });
        } finally {
            setAssigningHeadTeacher(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    useEffect(() => {
        if (activeYear) loadGradesWithCount(false);
        loadTeachers();
    }, [refreshKey, activeYear?.id]);

    const handleDeleteClick = (id) => {
        setGradeToDelete(id);
        setShowConfirm(true);
    };

    const confirmDelete = async () => {
        if (gradeToDelete) {
            setLoading(true);
            try {
                await api.delete(`/grades/${gradeToDelete}`);
                setMessage({ type: 'success', text: 'Grado eliminado' });
                loadGradesWithCount(false);
                if (currentGrades.length === 1 && currentPage > 1) {
                    setCurrentPage(currentPage - 1);
                }
            } catch (err) {
                setMessage({ type: 'error', text: err.response?.data?.message || 'Error al eliminar' });
            } finally {
                setLoading(false);
                setTimeout(() => setMessage(null), 3000);
            }
        }
        setShowConfirm(false);
        setGradeToDelete(null);
    };

    const cancelDelete = () => setShowConfirm(false);

    const goToPage = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const filteredTeachers = teachers.filter(t =>
        t.name.toLowerCase().includes(searchTeacher.toLowerCase())
    );

    const getTeacherName = (teacherId) => {
        const teacher = teachers.find(t => t.id === teacherId);
        return teacher ? teacher.name : 'Sin director';
    };

    return (
        <div className="max-w-6xl mx-auto px-6 py-6">
            {message && (
                <div className={`fixed top-5 right-5 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm ${
                    message.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                }`}>
                    {message.text}
                </div>
            )}

            <div className="flex mb-6 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('create')}
                    className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                        activeTab === 'create'
                            ? 'border-blue-700 text-blue-700'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    Crear grado
                </button>
                <button
                    onClick={() => setActiveTab('list')}
                    className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                        activeTab === 'list'
                            ? 'border-blue-700 text-blue-700'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    Listado de grados
                </button>
            </div>

            {activeTab === 'create' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 card-hover">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h2 className="text-[15px] font-semibold text-gray-800">Crear grado</h2>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Nombre del grado</label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="Ej: 1°A"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium text-gray-600">Estudiantes</label>
                                <span className="text-xs text-gray-400">{form.students.length} agregados</span>
                            </div>

                            {form.students.length > 0 && (
                                <div className="mb-3 bg-gray-50 rounded-lg p-2 max-h-40 overflow-y-auto">
                                    {form.students.map((student, idx) => (
                                        <div key={idx} className="flex items-center justify-between text-sm py-1.5 px-2">
                                            <div className="flex gap-3">
                                                <span className="text-gray-700">{student.fullName}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeStudentFromList(idx)}
                                                className="text-rose-400 hover:text-rose-600 text-xs"
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Nombre del estudiante"
                                    value={newStudentName}
                                    onChange={(e) => setNewStudentName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addStudentToList())}
                                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={addStudentToList}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition"
                                >
                                    Agregar
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-700 hover:bg-blue-800 text-white font-medium btn-press py-2 rounded-lg transition disabled:opacity-50 text-sm"
                        >
                            {loading ? 'Creando...' : `Crear grado${form.students.length ? ` (${form.students.length} estudiantes)` : ''}`}
                        </button>
                    </form>
                </div>
            )}

            {activeTab === 'list' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 card-hover overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                        <h2 className="text-[15px] font-semibold text-gray-800">Listado de grados</h2>
                        <button
                            onClick={loadGradesWithCount}
                            className="text-gray-500 hover:text-gray-700 text-sm transition flex items-center gap-1"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                            </svg>
                            Actualizar
                        </button>
                    </div>

                    {/* Listados del año lectivo completo: un curso por hoja (Excel)
                        o por sección (PDF y vista previa), en el orden de los grados. */}
                    <div className="px-6 py-3 border-b border-gray-100 bg-white flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-gray-500 mr-1">Todos los grados —</span>
                        <span className="text-xs text-gray-400">Listado:</span>
                        <button
                            onClick={() => descargarListado('ver', true)}
                            disabled={descargandoListado !== null}
                            title="Ver en pantalla el listado de todos los grados, listo para imprimir"
                            className="px-3 py-1.5 text-xs font-medium rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {descargandoListado === 'todos-ver' ? 'Abriendo...' : 'Ver'}
                        </button>
                        <button
                            onClick={() => descargarListado('pdf', true)}
                            disabled={descargandoListado !== null}
                            title="Descargar en PDF el listado de todos los grados"
                            className="px-3 py-1.5 text-xs font-medium rounded-md border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {descargandoListado === 'todos-pdf' ? 'Generando...' : 'PDF'}
                        </button>
                        <button
                            onClick={() => descargarListado('excel', true)}
                            disabled={descargandoListado !== null}
                            title="Descargar en Excel el listado de todos los grados, una hoja por curso"
                            className="px-3 py-1.5 text-xs font-medium rounded-md border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {descargandoListado === 'todos-excel' ? 'Generando...' : 'Excel'}
                        </button>
                        <span className="text-xs text-gray-400 ml-2 pl-2 border-l border-gray-200">Datos:</span>
                        <button
                            onClick={() => descargarListado('datos-word', true)}
                            disabled={descargandoListado !== null}
                            title="Descargar en Word todos los datos de los estudiantes de todos los grados"
                            className="px-3 py-1.5 text-xs font-medium rounded-md border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {descargandoListado === 'todos-datos-word' ? 'Generando...' : 'Word'}
                        </button>
                        <button
                            onClick={() => descargarListado('datos-excel', true)}
                            disabled={descargandoListado !== null}
                            title="Descargar en Excel todos los datos de los estudiantes de todos los grados"
                            className="px-3 py-1.5 text-xs font-medium rounded-md border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {descargandoListado === 'todos-datos-excel' ? 'Generando...' : 'Excel'}
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Grado</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Director</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Estudiantes</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {currentGrades.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="px-5 py-8 text-center text-gray-400 text-sm">
                                            No hay grados registrados
                                        </td>
                                    </tr>
                                ) : (
                                    currentGrades.map((grade) => (
                                        <tr key={grade.group_id} className="hover:bg-gray-50/50">
                                            <td className="px-5 py-3 font-medium text-gray-800">{grade.displayName || grade.name}</td>
                                            <td className="px-5 py-3 relative">
                                                <div className="relative">
                                                    <button
                                                        onClick={() => setOpenSelect(openSelect === grade.group_id ? null : grade.group_id)}
                                                        className="w-48 text-left px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white flex items-center justify-between"
                                                    >
                                                        <span className={grade.head_teacher_id ? 'text-gray-700' : 'text-gray-400'}>
                                                            {getTeacherName(grade.head_teacher_id)}
                                                        </span>
                                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                                        </svg>
                                                    </button>

                                                    {openSelect === grade.group_id && (
                                                        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                                                            <div className="p-2 border-b border-gray-100">
                                                                <input
                                                                    type="text"
                                                                    placeholder="Buscar docente..."
                                                                    value={searchTeacher}
                                                                    onChange={(e) => setSearchTeacher(e.target.value)}
                                                                    className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 outline-none"
                                                                />
                                                            </div>
                                                            <div className="max-h-48 overflow-y-auto">
                                                                <div
                                                                    onClick={() => assignHeadTeacher(grade.group_id, null)}
                                                                    className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 transition"
                                                                >
                                                                    Sin director
                                                                </div>
                                                                {filteredTeachers.map((teacher) => (
                                                                    <div
                                                                        key={teacher.id}
                                                                        onClick={() => assignHeadTeacher(grade.group_id, teacher.id)}
                                                                        className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 transition"
                                                                    >
                                                                        {teacher.name}
                                                                    </div>
                                                                ))}
                                                                {filteredTeachers.length === 0 && (
                                                                    <div className="px-3 py-2 text-sm text-gray-400 text-center">
                                                                        No hay docentes
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <button
                                                    onClick={() => loadStudentsByGrade(grade.id, grade.displayName || grade.name, grade.group_id)}
                                                    className="text-blue-700 hover:text-blue-700 text-sm font-medium"
                                                >
                                                    Editar ({grade.studentCount || 0})
                                                </button>
                                            </td>
                                            <td className="px-5 py-3">
                                                <button
                                                    onClick={() => handleDeleteClick(grade.id)}
                                                    className="text-red-400 hover:text-red-500 text-sm transition"
                                                >
                                                    Eliminar
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-2 py-4 border-t border-gray-100 bg-gray-50/50">
                            <button
                                onClick={() => goToPage(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                                Anterior
                            </button>
                            <div className="flex gap-1">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                    <button
                                        key={page}
                                        onClick={() => goToPage(page)}
                                        className={`w-7 h-7 text-xs rounded-md transition ${
                                            currentPage === page
                                                ? 'bg-blue-700 text-white'
                                                : 'text-gray-600 hover:bg-gray-100'
                                        }`}
                                    >
                                        {page}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => goToPage(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                                Siguiente
                            </button>
                        </div>
                    )}
                </div>
            )}

            {showStudentsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden">
                        <div className="flex justify-between items-center px-5 py-3 border-b border-gray-100 bg-gray-50">
                            <h3 className="text-[15px] font-semibold text-gray-800">{selectedGrade}</h3>

                            <div className="flex items-center gap-2 flex-wrap justify-end">
                                <span className="text-xs text-gray-400">Listado:</span>
                                <button
                                    onClick={() => descargarListado('ver')}
                                    disabled={descargandoListado !== null}
                                    title="Ver el listado en pantalla y poder imprimirlo"
                                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {descargandoListado === 'ver' ? 'Abriendo...' : 'Ver'}
                                </button>
                                <button
                                    onClick={() => descargarListado('pdf')}
                                    disabled={descargandoListado !== null}
                                    title="Descargar el listado del grado en PDF"
                                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {descargandoListado === 'pdf' ? 'Generando...' : 'PDF'}
                                </button>
                                <button
                                    onClick={() => descargarListado('excel')}
                                    disabled={descargandoListado !== null}
                                    title="Descargar el listado del grado en Excel"
                                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {descargandoListado === 'excel' ? 'Generando...' : 'Excel'}
                                </button>
                                <span className="text-xs text-gray-400 ml-2 pl-2 border-l border-gray-200">Datos:</span>
                                <button
                                    onClick={() => descargarListado('datos-word')}
                                    disabled={descargandoListado !== null}
                                    title="Descargar todos los datos de los estudiantes en Word"
                                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {descargandoListado === 'datos-word' ? 'Generando...' : 'Word'}
                                </button>
                                <button
                                    onClick={() => descargarListado('datos-excel')}
                                    disabled={descargandoListado !== null}
                                    title="Descargar todos los datos de los estudiantes en Excel"
                                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {descargandoListado === 'datos-excel' ? 'Generando...' : 'Excel'}
                                </button>
                                <button
                                    onClick={() => setShowStudentsModal(false)}
                                    className="text-gray-400 hover:text-gray-600 text-xl ml-1"
                                >
                                    &times;
                                </button>
                            </div>
                        </div>

                        <div className="p-5 overflow-y-auto max-h-[calc(85vh-120px)] bg-gray-50">
                            {loadingStudents ? (
                                <div className="flex justify-center py-8">
                                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : (
                                <>
                                    <div className="bg-white rounded-lg border border-gray-100 overflow-hidden mb-5">
                                        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/50">
                                            <span className="text-xs font-medium text-gray-500">Estudiantes ({studentsInGrade.length})</span>
                                        </div>

                                        {studentsInGrade.length === 0 ? (
                                            <div className="p-6 text-center text-gray-400 text-sm">
                                                No hay estudiantes
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-gray-50 border-b border-gray-100">
                                                        <tr>
                                                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">N°</th>
                                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Nombre</th>
                                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Codigo</th>
                                                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Acciones</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-50">
                                                        {studentsInGrade.map((student, indice) => (
                                                            <tr key={student.id} className="hover:bg-gray-50/50">
                                                                <td className="px-4 py-2 text-center font-bold text-gray-700">
                                                                    {indice + 1}
                                                                </td>
                                                                <td className="px-4 py-2">
                                                                    {editingStudent?.id === student.id ? (
                                                                        <div className="flex gap-1">
                                                                            <input
                                                                                type="text"
                                                                                value={editingStudent.last_name ?? editingStudent.lastName ?? ''}
                                                                                onChange={(e) => setEditingStudent({ ...editingStudent, last_name: e.target.value, lastName: e.target.value })}
                                                                                placeholder="Apellidos"
                                                                                className="w-1/2 px-2 py-1 border border-gray-200 rounded text-sm"
                                                                            />
                                                                            <input
                                                                                type="text"
                                                                                value={editingStudent.first_name ?? editingStudent.firstName ?? ''}
                                                                                onChange={(e) => setEditingStudent({ ...editingStudent, first_name: e.target.value, firstName: e.target.value })}
                                                                                placeholder="Nombres"
                                                                                className="w-1/2 px-2 py-1 border border-gray-200 rounded text-sm"
                                                                            />
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-gray-700">{student.full_name}</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-2">
                                                                    <span className="text-gray-400 text-xs font-mono">{student.student_code}</span>
                                                                </td>
                                                                <td className="px-4 py-2 text-center">
                                                                    {editingStudent?.id === student.id ? (
                                                                        <div className="flex justify-center gap-2">
                                                                            <button
                                                                                onClick={updateStudent}
                                                                                className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 rounded text-xs font-medium"
                                                                            >
                                                                                Guardar
                                                                            </button>
                                                                            <button
                                                                                onClick={() => setEditingStudent(null)}
                                                                                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-3 py-1 rounded text-xs font-medium"
                                                                            >
                                                                                Cancelar
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex justify-center gap-3">
                                                                            <button
                                                                                onClick={() => setEditingStudent(student)}
                                                                                className="text-blue-700 hover:text-blue-700 text-xs font-medium"
                                                                            >
                                                                                Editar
                                                                            </button>
                                                                            <button
                                                                                onClick={() => deleteStudentFromGrade(student.enrollmentId)}
                                                                                className="text-red-400 hover:text-red-500 text-xs font-medium"
                                                                            >
                                                                                Eliminar
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-white rounded-lg border border-gray-100 p-4">
                                        <label className="text-sm font-medium text-gray-600 mb-2 block">Agregar estudiante</label>
                                        <p className="text-xs text-gray-400 mb-2">El código se genera automáticamente.</p>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Nombre del estudiante"
                                                value={newStudentName}
                                                onChange={(e) => setNewStudentName(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && addStudentToGrade()}
                                                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                            />
                                            <button
                                                onClick={addStudentToGrade}
                                                disabled={loading}
                                                className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
                                            >
                                                {loading ? 'Agregando...' : 'Agregar'}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <button
                                onClick={() => setShowStudentsModal(false)}
                                className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 px-4 py-1.5 rounded-lg text-sm transition"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={showConfirm}
                onClose={cancelDelete}
                onConfirm={confirmDelete}
                title="Eliminar grado"
                message={
                    <div>
                        <p className="font-medium text-gray-800 mb-2">¿Estás seguro de que deseas eliminar este grado?</p>
                        <div className="bg-red-50 border border-red-100 rounded-md px-3 py-2 text-xs text-red-700 space-y-1">
                            <p>Advertencia: Esta acción eliminará en cascada:</p>
                            <ul className="list-disc list-inside space-y-0.5 ml-1">
                                <li>Todos los grupos del grado</li>
                                <li>Todas las matrículas asociadas</li>
                                <li>Todas las asignaciones de asignaturas</li>
                            </ul>
                            <p className="mt-1 font-medium">Las notas registradas también quedarán afectadas.</p>
                        </div>
                    </div>
                }
                confirmText="Sí, eliminar"
                cancelText="Cancelar"
            />

            <ConfirmDialog
                isOpen={showConfirmStudent}
                onClose={cancelDeleteStudent}
                onConfirm={confirmDeleteStudent}
                title="Eliminar estudiante"
                message="¿Estás seguro de que deseas eliminar este estudiante? Esta acción no se puede deshacer."
                confirmText="Eliminar"
                cancelText="Cancelar"
            />
        </div>
    );
};

export default Grades;

