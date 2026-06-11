import { useState, useEffect } from 'react';
import api from '../../api/client';
import { useRefresh } from '../../contexts/RefreshContext';
import { useActiveAcademicYear } from '../../hooks/useActiveAcademicYear';

const Reports = () => {
    const { refreshKey } = useRefresh();
    const { activeYear, loading: yearLoading } = useActiveAcademicYear();
    
    const [grades, setGrades] = useState([]);
    const [periods, setPeriods] = useState([]);
    
    // Estado para reporte por estudiante (seccion 1)
    const [selectedGradeStudent, setSelectedGradeStudent] = useState('');
    const [studentsByGrade, setStudentsByGrade] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState('');
    const [selectedStudentName, setSelectedStudentName] = useState('');
    const [studentReportType, setStudentReportType] = useState('period');
    const [selectedPeriodStudent, setSelectedPeriodStudent] = useState('');
    const [showStudentModal, setShowStudentModal] = useState(false);
    const [studentSearch, setStudentSearch] = useState('');
    
    // Estado para tabla de notas por grado (seccion 2)
    const [selectedGradeTable, setSelectedGradeTable] = useState('');
    const [selectedPeriodTable, setSelectedPeriodTable] = useState('');

    // Estado para reporte de grado (seccion 3)
    const [selectedGradeForGroup, setSelectedGradeForGroup] = useState('');
    const [gradeReportType, setGradeReportType] = useState('period');
    const [selectedPeriodGrade, setSelectedPeriodGrade] = useState('');
    
    // Estado para reporte masivo (seccion 3)
    const [massiveReportType, setMassiveReportType] = useState('period');
    const [selectedPeriodMassive, setSelectedPeriodMassive] = useState('');
    
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const extractData = (response) => {
        if (!response) return [];
        if (response.data && Array.isArray(response.data)) return response.data;
        if (Array.isArray(response)) return response;
        if (response.data && response.data.data && Array.isArray(response.data.data)) return response.data.data;
        return [];
    };

    const showMessage = (text, type = 'error') => {
        setMessage({ text, type });
        setTimeout(() => setMessage(null), 3000);
    };

    const cleanFileName = (name) => {
        return name
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\s]/gi, '')
            .replace(/\s+/g, '_');
    };

    const downloadFile = async (url, filename) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${api.defaults.baseURL}${url}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error en la descarga');
            }
            
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (error) {
            console.error('Error descargando archivo:', error);
            showMessage(error.message || 'Error al generar el reporte', 'error');
        }
    };

    const downloadZip = async (url, filename) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${api.defaults.baseURL}${url}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error en la descarga');
            }
            
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (error) {
            console.error('Error descargando ZIP:', error);
            showMessage(error.message || 'Error al generar el reporte', 'error');
        }
    };

    // Cargar grados
    useEffect(() => {
        const loadGrades = async () => {
            const gradesRes = await api.get('/grades');
            const gradesData = extractData(gradesRes.data);
            gradesData.sort((a, b) => {
                const numA = parseInt(a.name) || 0;
                const numB = parseInt(b.name) || 0;
                if (numA !== numB) return numA - numB;
                return a.name.localeCompare(b.name);
            });
            setGrades(gradesData);
        };
        loadGrades();
    }, [refreshKey]);

    // Cargar periodos
    useEffect(() => {
        if (activeYear) {
            const loadPeriods = async () => {
                const res = await api.get(`/periods?academicYearId=${activeYear.id}`);
                const periodsData = extractData(res.data);
                setPeriods(periodsData);
                if (periodsData.length > 0) {
                    setSelectedPeriodStudent(periodsData[0].id.toString());
                    setSelectedPeriodTable(periodsData[0].id.toString());
                    setSelectedPeriodGrade(periodsData[0].id.toString());
                    setSelectedPeriodMassive(periodsData[0].id.toString());
                }
            };
            loadPeriods();
        }
    }, [activeYear]);

    // Cargar estudiantes por grado
    useEffect(() => {
        if (selectedGradeStudent && activeYear) {
            const loadStudents = async () => {
                setLoading(true);
                try {
                    const groupsRes = await api.get(`/groups/by-grade/${selectedGradeStudent}`);
                    const groups = extractData(groupsRes.data);
                    const groupIds = groups.map(g => g.id);
                    
                    if (groupIds.length === 0) {
                        setStudentsByGrade([]);
                        setLoading(false);
                        return;
                    }
                    
                    let allEnrollments = [];
                    for (const groupId of groupIds) {
                        const enrollmentsRes = await api.get(`/enrollments?groupId=${groupId}&academicYearId=${activeYear.id}`);
                        const enrollments = extractData(enrollmentsRes.data);
                        allEnrollments = [...allEnrollments, ...enrollments];
                    }
                    
                    const studentsData = await Promise.all(allEnrollments.map(async e => {
                        const sRes = await api.get(`/students/${e.student_id}`);
                        return sRes.data;
                    }));
                    
                    const uniqueStudents = [];
                    const seenIds = new Set();
                    for (const student of studentsData) {
                        if (!seenIds.has(student.id)) {
                            seenIds.add(student.id);
                            uniqueStudents.push(student);
                        }
                    }
                    uniqueStudents.sort((a, b) => a.full_name.localeCompare(b.full_name));
                    setStudentsByGrade(uniqueStudents);
                } catch (error) {
                    console.error('Error cargando estudiantes:', error);
                    setStudentsByGrade([]);
                } finally {
                    setLoading(false);
                }
            };
            loadStudents();
        } else {
            setStudentsByGrade([]);
            setSelectedStudent('');
            setSelectedStudentName('');
        }
    }, [selectedGradeStudent, activeYear]);

    // ==================== SECCION 1: REPORTE POR ESTUDIANTE ====================
    const handleGenerateStudentWord = () => {
        if (!activeYear || !selectedGradeStudent || !selectedStudent) {
            showMessage('Seleccione grado y estudiante', 'error');
            return;
        }
        if (studentReportType === 'period' && !selectedPeriodStudent) {
            showMessage('Seleccione un período', 'error');
            return;
        }
        
        const selectedStudentObj = studentsByGrade.find(s => s.id.toString() === selectedStudent);
        let studentName = 'Estudiante';
        if (selectedStudentObj) studentName = cleanFileName(selectedStudentObj.full_name);
        
        if (studentReportType === 'period') {
            const selectedPeriodObj = periods.find(p => p.id.toString() === selectedPeriodStudent);
            const periodOrder = selectedPeriodObj ? (selectedPeriodObj.order || '1') : '1';
            const fileName = `Boletin_${studentName}_Periodo_${periodOrder}.docx`;
            downloadFile(`/reports/period-report-word?studentId=${selectedStudent}&academicYearId=${activeYear.id}&periodId=${selectedPeriodStudent}&studentName=${studentName}&periodName=${periodOrder}`, fileName);
        } else {
            const fileName = `Boletin_${studentName}_Final.docx`;
            downloadFile(`/reports/final-report-word?studentId=${selectedStudent}&academicYearId=${activeYear.id}&studentName=${studentName}`, fileName);
        }
    };

    const handleGenerateStudentExcel = () => {
        if (!activeYear || !selectedGradeStudent || !selectedStudent) {
            showMessage('Seleccione grado y estudiante', 'error');
            return;
        }
        if (studentReportType === 'period' && !selectedPeriodStudent) {
            showMessage('Seleccione un período', 'error');
            return;
        }
        
        if (studentReportType === 'period') {
            downloadFile(`/reports/period-report-excel?studentId=${selectedStudent}&academicYearId=${activeYear.id}&periodId=${selectedPeriodStudent}`, `Boletin_Excel_${selectedStudent}_Periodo.xlsx`);
        } else {
            downloadFile(`/reports/final-report-excel?studentId=${selectedStudent}&academicYearId=${activeYear.id}`, `Boletin_Excel_${selectedStudent}_Final.xlsx`);
        }
    };

    // ==================== SECCION 2: TABLA DE NOTAS POR GRADO ====================
    const handleDownloadCognitiveNotes = () => {
        if (!activeYear || !selectedGradeTable || !selectedPeriodTable) {
            showMessage('Seleccione grado y período', 'error');
            return;
        }
        const fileName = `Reporte_Notas_Cognitivas_Grado_${selectedGradeTable}_Periodo_${selectedPeriodTable}.xlsx`;
        downloadFile(`/reports/grade-report-excel?academicYearId=${activeYear.id}&periodId=${selectedPeriodTable}&gradeId=${selectedGradeTable}`, fileName);
    };

    const handleDownloadAttitudinalNotes = () => {
        if (!activeYear || !selectedGradeTable || !selectedPeriodTable) {
            showMessage('Seleccione grado y período', 'error');
            return;
        }
        const fileName = `Reporte_Notas_Actitudinales_Grado_${selectedGradeTable}_Periodo_${selectedPeriodTable}.xlsx`;
        downloadFile(`/reports/grade-report-attitudinal-excel?academicYearId=${activeYear.id}&periodId=${selectedPeriodTable}&gradeId=${selectedGradeTable}`, fileName);
    };

    const handleDownloadElectivesNotes = () => {
        if (!activeYear || !selectedGradeTable || !selectedPeriodTable) {
            showMessage('Seleccione grado y período', 'error');
            return;
        }
        const fileName = `Reporte_Notas_Electivas_Grado_${selectedGradeTable}_Periodo_${selectedPeriodTable}.xlsx`;
        downloadFile(`/reports/grade-report-electives-excel?academicYearId=${activeYear.id}&periodId=${selectedPeriodTable}&gradeId=${selectedGradeTable}`, fileName);
    };

    const handleDownloadCognitiveNotesWord = () => {
        if (!activeYear || !selectedGradeTable || !selectedPeriodTable) { showMessage('Seleccione grado y período', 'error'); return; }
        downloadFile(`/reports/grade-report-word?academicYearId=${activeYear.id}&periodId=${selectedPeriodTable}&gradeId=${selectedGradeTable}`,
            `Reporte_Notas_Cognitivas_Grado_${selectedGradeTable}_Periodo_${selectedPeriodTable}.docx`);
    };
    const handleDownloadAttitudinalNotesWord = () => {
        if (!activeYear || !selectedGradeTable || !selectedPeriodTable) { showMessage('Seleccione grado y período', 'error'); return; }
        downloadFile(`/reports/grade-report-attitudinal-word?academicYearId=${activeYear.id}&periodId=${selectedPeriodTable}&gradeId=${selectedGradeTable}`,
            `Reporte_Notas_Actitudinales_Grado_${selectedGradeTable}_Periodo_${selectedPeriodTable}.docx`);
    };
    const handleDownloadElectivesNotesWord = () => {
        if (!activeYear || !selectedGradeTable || !selectedPeriodTable) { showMessage('Seleccione grado y período', 'error'); return; }
        downloadFile(`/reports/grade-report-electives-word?academicYearId=${activeYear.id}&periodId=${selectedPeriodTable}&gradeId=${selectedGradeTable}`,
            `Reporte_Notas_Electivas_Grado_${selectedGradeTable}_Periodo_${selectedPeriodTable}.docx`);
    };

    // ==================== SECCION 3: REPORTE POR GRADO (todos los estudiantes del grado) ====================
    const handleGenerateGradeWord = () => {
        if (!activeYear || !selectedGradeForGroup) {
            showMessage('Seleccione un grado', 'error');
            return;
        }
        if (gradeReportType === 'period' && !selectedPeriodGrade) {
            showMessage('Seleccione un período', 'error');
            return;
        }
        
        const selectedGradeObj = grades.find(g => g.id.toString() === selectedGradeForGroup);
        const gradeName = selectedGradeObj ? cleanFileName(selectedGradeObj.name) : selectedGradeForGroup;
        
        if (gradeReportType === 'period') {
            const selectedPeriodObj = periods.find(p => p.id.toString() === selectedPeriodGrade);
            const periodOrder = selectedPeriodObj ? (selectedPeriodObj.order || '1') : '1';
            const fileName = `Boletines_Grado_${gradeName}_Periodo_${periodOrder}.zip`;
            downloadZip(`/reports/bulk-word-reports?academicYearId=${activeYear.id}&gradeId=${selectedGradeForGroup}&type=period&periodId=${selectedPeriodGrade}`, fileName);
        } else {
            const fileName = `Boletines_Grado_${gradeName}_Final.zip`;
            downloadZip(`/reports/bulk-word-reports?academicYearId=${activeYear.id}&gradeId=${selectedGradeForGroup}&type=final`, fileName);
        }
    };

    const handleGenerateGradeExcel = () => {
        if (!activeYear || !selectedGradeForGroup || !selectedPeriodGrade) {
            showMessage('Seleccione grado y período', 'error');
            return;
        }
        
        const fileName = `Reporte_Notas_Grado_${selectedGradeForGroup}_Periodo_${selectedPeriodGrade}.xlsx`;
        downloadFile(`/reports/grade-report-excel?academicYearId=${activeYear.id}&periodId=${selectedPeriodGrade}&gradeId=${selectedGradeForGroup}`, fileName);
    };

    // ==================== SECCION 4: REPORTE MASIVO (todos los grados) ====================
    const handleGenerateMassiveWord = () => {
        if (!activeYear) {
            showMessage('No hay año lectivo activo', 'error');
            return;
        }
        if (massiveReportType === 'period' && !selectedPeriodMassive) {
            showMessage('Seleccione un período', 'error');
            return;
        }
        
        if (massiveReportType === 'period') {
            const selectedPeriodObj = periods.find(p => p.id.toString() === selectedPeriodMassive);
            const periodOrder = selectedPeriodObj ? (selectedPeriodObj.order || '1') : '1';
            const fileName = `Boletines_Masivos_Periodo_${periodOrder}.zip`;
            downloadZip(`/reports/bulk-word-reports?academicYearId=${activeYear.id}&type=massive_period&periodId=${selectedPeriodMassive}`, fileName);
        } else {
            const fileName = `Boletines_Masivos_Final.zip`;
            downloadZip(`/reports/bulk-word-reports?academicYearId=${activeYear.id}&type=massive_final`, fileName);
        }
    };

    const handleGenerateMassiveExcel = () => {
        if (!activeYear) {
            showMessage('No hay año lectivo activo', 'error');
            return;
        }
        if (massiveReportType === 'period' && !selectedPeriodMassive) {
            showMessage('Seleccione un período', 'error');
            return;
        }
        
        const fileName = massiveReportType === 'period' 
            ? `Reportes_Excel_Masivos_Periodo_${selectedPeriodMassive}.zip` 
            : 'Reportes_Excel_Masivos_Final.zip';
        downloadZip(`/reports/bulk-excel-reports?academicYearId=${activeYear.id}&type=massive_${massiveReportType}&periodId=${selectedPeriodMassive}`, fileName);
    };

    if (yearLoading) return <div className="flex justify-center py-8">Cargando año activo...</div>;
    if (!activeYear) return <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center"><p className="text-blue-700">Para usar este módulo primero crea un año lectivo en <strong>Años lectivos</strong>.</p></div>;

    return (
        <div className="max-w-6xl mx-auto px-6 py-6 space-y-8">
            {message && (
                <div className={`fixed top-5 right-5 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm ${
                    message.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                }`}>
                    {message.text}
                </div>
            )}

            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">Año lectivo activo: <strong>{activeYear.name}</strong></p>
            </div>

            {/* ==================== SECCION 1: REPORTE POR ESTUDIANTE ==================== */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 card-hover p-6">
                <h2 className="text-[15px] font-semibold text-gray-800 mb-4">1. Reporte por estudiante</h2>
                <p className="text-xs text-gray-500 mb-4">Seleccione el grado, el estudiante y genere su boletín individual</p>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Grado</label>
                        <select value={selectedGradeStudent} onChange={(e) => setSelectedGradeStudent(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                            <option value="">Seleccione grado</option>
                            {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Estudiante</label>
                        <button
                            type="button"
                            disabled={!selectedGradeStudent || loading}
                            onClick={() => { setStudentSearch(''); setShowStudentModal(true); }}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-left flex items-center justify-between bg-white disabled:bg-gray-100 disabled:cursor-not-allowed hover:border-blue-400 transition"
                        >
                            <span className={selectedStudentName ? 'text-gray-700' : 'text-gray-400'}>
                                {loading ? 'Cargando...' : (selectedStudentName || 'Seleccione estudiante')}
                            </span>
                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </button>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Tipo de reporte</label>
                        <div className="flex gap-4 mt-1">
                            <label className="flex items-center gap-1 text-sm"><input type="radio" value="period" checked={studentReportType === 'period'} onChange={() => setStudentReportType('period')} /> Por período</label>
                            <label className="flex items-center gap-1 text-sm"><input type="radio" value="final" checked={studentReportType === 'final'} onChange={() => setStudentReportType('final')} /> Final</label>
                        </div>
                    </div>
                    {studentReportType === 'period' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Período</label>
                            <select value={selectedPeriodStudent} onChange={(e) => setSelectedPeriodStudent(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                                {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                    )}
                </div>
                
                <div className="flex gap-3">
                    <button onClick={handleGenerateStudentWord} className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded text-sm">Generar Word</button>
                    <button onClick={handleGenerateStudentExcel} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm">Generar Excel</button>
                </div>
            </div>

            {/* ==================== SECCION 2: TABLA DE NOTAS POR GRADO ==================== */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 card-hover p-6">
                <h2 className="text-[15px] font-semibold text-gray-800 mb-4">2. Reporte de notas por grado</h2>
                <p className="text-xs text-gray-500 mb-4">Descargue tablas de notas del grado por tipo: cognitivas, actitudinales o electivas</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Grado</label>
                        <select value={selectedGradeTable} onChange={(e) => setSelectedGradeTable(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                            <option value="">Seleccione grado</option>
                            {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Período</label>
                        <select value={selectedPeriodTable} onChange={(e) => setSelectedPeriodTable(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                            {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex gap-3 flex-wrap items-center">
                    <span className="text-xs text-gray-500 font-medium">Excel:</span>
                    <button onClick={handleDownloadCognitiveNotes} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm">Notas cognitivas</button>
                    <button onClick={handleDownloadAttitudinalNotes} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded text-sm">Notas actitudinales</button>
                    <button onClick={handleDownloadElectivesNotes} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm">Notas electivas</button>
                </div>
                <div className="flex gap-3 flex-wrap items-center mt-2">
                    <span className="text-xs text-gray-500 font-medium">Word:</span>
                    <button onClick={handleDownloadCognitiveNotesWord} className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded text-sm">Notas cognitivas</button>
                    <button onClick={handleDownloadAttitudinalNotesWord} className="bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 rounded text-sm">Notas actitudinales</button>
                    <button onClick={handleDownloadElectivesNotesWord} className="bg-indigo-700 hover:bg-indigo-800 text-white px-4 py-2 rounded text-sm">Notas electivas</button>
                </div>
            </div>

            {/* ==================== SECCION 3: REPORTE POR GRADO (todos los estudiantes del grado) ==================== */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 card-hover p-6">
                <h2 className="text-[15px] font-semibold text-gray-800 mb-4">3. Reporte por grado</h2>
                <p className="text-xs text-gray-500 mb-4">Seleccione un grado para generar reportes de TODOS sus estudiantes</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Grado</label>
                        <select value={selectedGradeForGroup} onChange={(e) => setSelectedGradeForGroup(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                            <option value="">Seleccione grado</option>
                            {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Tipo de reporte</label>
                        <div className="flex gap-4 mt-1">
                            <label className="flex items-center gap-1 text-sm"><input type="radio" value="period" checked={gradeReportType === 'period'} onChange={() => setGradeReportType('period')} /> Por período</label>
                            <label className="flex items-center gap-1 text-sm"><input type="radio" value="final" checked={gradeReportType === 'final'} onChange={() => setGradeReportType('final')} /> Final</label>
                        </div>
                    </div>
                    {gradeReportType === 'period' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Período</label>
                            <select value={selectedPeriodGrade} onChange={(e) => setSelectedPeriodGrade(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                                {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                    )}
                </div>
                
                <div className="flex gap-3">
                    <button onClick={handleGenerateGradeWord} className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded text-sm">Generar Word (ZIP)</button>
                    <button onClick={handleGenerateGradeExcel} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm">Generar Excel</button>
                </div>
            </div>

            {/* ==================== SECCION 4: REPORTE MASIVO (todos los grados) ==================== */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 card-hover p-6">
                <h2 className="text-[15px] font-semibold text-gray-800 mb-4">4. Reporte masivo (todos los grados)</h2>
                <p className="text-xs text-gray-500 mb-4">Genera reportes de TODOS los estudiantes de TODOS los grados</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Tipo de reporte</label>
                        <div className="flex gap-4 mt-1">
                            <label className="flex items-center gap-1 text-sm"><input type="radio" value="period" checked={massiveReportType === 'period'} onChange={() => setMassiveReportType('period')} /> Por período</label>
                            <label className="flex items-center gap-1 text-sm"><input type="radio" value="final" checked={massiveReportType === 'final'} onChange={() => setMassiveReportType('final')} /> Final</label>
                        </div>
                    </div>
                    {massiveReportType === 'period' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Período</label>
                            <select value={selectedPeriodMassive} onChange={(e) => setSelectedPeriodMassive(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                                {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                    )}
                </div>
                
                <div className="flex gap-3">
                    <button onClick={handleGenerateMassiveWord} className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded text-sm">Generar Word (ZIP)</button>
                    <button onClick={handleGenerateMassiveExcel} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm">Generar Excel (ZIP)</button>
                </div>
            </div>

            {/* Modal selección de estudiante */}
            {showStudentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            <h3 className="text-[15px] font-semibold text-gray-800">
                                Seleccionar estudiante
                            </h3>
                            <button
                                onClick={() => setShowStudentModal(false)}
                                className="text-gray-400 hover:text-gray-600 transition text-xl leading-none"
                            >
                                ×
                            </button>
                        </div>

                        <div className="px-5 py-3 border-b border-gray-100">
                            <input
                                type="text"
                                placeholder="Buscar por nombre o código..."
                                value={studentSearch}
                                onChange={(e) => setStudentSearch(e.target.value)}
                                autoFocus
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        <div className="overflow-y-auto max-h-72 divide-y divide-gray-50">
                            {studentsByGrade.length === 0 ? (
                                <p className="px-5 py-6 text-center text-sm text-gray-400">
                                    No hay estudiantes en este grado
                                </p>
                            ) : (
                                (() => {
                                    const filtered = studentsByGrade.filter(s =>
                                        s.full_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                                        (s.student_code || '').toLowerCase().includes(studentSearch.toLowerCase())
                                    );
                                    return filtered.length === 0 ? (
                                        <p className="px-5 py-6 text-center text-sm text-gray-400">Sin resultados</p>
                                    ) : (
                                        filtered.map((s, idx) => (
                                            <div
                                                key={s.id}
                                                onClick={() => {
                                                    setSelectedStudent(s.id.toString());
                                                    setSelectedStudentName(s.full_name);
                                                    setShowStudentModal(false);
                                                    setStudentSearch('');
                                                }}
                                                className={`flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-blue-50 transition ${
                                                    selectedStudent === s.id.toString() ? 'bg-blue-50' : ''
                                                }`}
                                            >
                                                <span className="w-6 h-6 flex-shrink-0 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center font-medium">
                                                    {idx + 1}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-800 truncate">{s.full_name}</p>
                                                    {s.student_code && (
                                                        <p className="text-xs text-gray-400">{s.student_code}</p>
                                                    )}
                                                </div>
                                                {selectedStudent === s.id.toString() && (
                                                    <svg className="w-4 h-4 text-blue-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>
                                        ))
                                    );
                                })()
                            )}
                        </div>

                        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
                            <button
                                onClick={() => setShowStudentModal(false)}
                                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Reports;