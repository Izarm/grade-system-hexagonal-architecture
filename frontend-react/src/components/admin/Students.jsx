import { useState, useEffect } from 'react';
import api from '../../api/client';
import { apellidosDe, nombresDe, validarNombre } from '../../utils/nombres';
import CampoFecha from '../common/CampoFecha';
import ConfirmDialog from '../common/ConfirmDialog';
import { useRefresh } from '../../contexts/RefreshContext';
import { STUDENT_DOCS } from '../../constants/documents';

const Students = () => {
    const { refreshKey, refresh } = useRefresh();
    const [students, setStudents] = useState([]);
    const [codeLoading, setCodeLoading] = useState(false);
    const [form, setForm] = useState({
        id: '', lastName: '', firstName: '', studentCode: '',
        // Campos de San José de Tarbes
        birthDate: '',
        documentType: '', documentIssueDate: '', documentIssuePlace: '', documentNumber: '', phoneLandline: '', phoneMobile1: '', phoneMobile2: '',
        emailFather: '', emailMother: '', address: '', guardian: '',
        admissionDate: '', withdrawalDate: '', withdrawalReason: '', observations: '',
        documents: [],
    });
    const [formStep, setFormStep] = useState(0); // 0 = datos básicos, 1 = datos complementarios
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [studentToDelete, setStudentToDelete] = useState(null);
    const [activeTab, setActiveTab] = useState('create');

    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(20);

    const normalize = (str) => str?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') || '';
    const filteredStudents = students.filter(s => normalize(s.full_name).includes(normalize(search)));
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentStudents = filteredStudents.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);

    const loadStudents = async (resetPage = true) => {
        try {
            const res = await api.get('/students');
            const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
            setStudents(data);
            if (resetPage) setCurrentPage(1);
        } catch (error) {
            console.error('Error cargando estudiantes:', error);
            setStudents([]);
        }
    };

    const fetchNextCode = async () => {
        if (form.id) return; // no auto-generar si estamos editando
        setCodeLoading(true);
        try {
            const res = await api.get('/students/generate-code');
            setForm(f => ({ ...f, studentCode: res.data.code }));
        } catch (e) {
            console.error('Error generando código:', e);
        } finally {
            setCodeLoading(false);
        }
    };

    useEffect(() => {
        loadStudents();
    }, [refreshKey]);

    useEffect(() => {
        if (activeTab === 'create' && !form.id) {
            fetchNextCode();
        }
    }, [activeTab]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.lastName || !form.firstName) {
            setMessage({ type: 'error', text: 'Los apellidos y los nombres son obligatorios' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }

        // Mismos mensajes que usa el servidor.
        const erroresNombre = validarNombre(form);
        if (Object.keys(erroresNombre).length > 0) {
            setMessage({ type: 'error', text: Object.values(erroresNombre)[0] });
            setTimeout(() => setMessage(null), 4000);
            return;
        }
        setLoading(true);
        setMessage(null);
        try {
            const payload = {
                lastName:         form.lastName.trim(),
                firstName:        form.firstName.trim(),
                studentCode:      form.studentCode,
                birthDate:        form.birthDate        || null,
                documentType:     form.documentType     || null,
                documentNumber:   form.documentNumber   || null,
                documentIssueDate: form.documentIssueDate || null,
                documentIssuePlace:form.documentIssuePlace|| null,
                phoneLandline:    form.phoneLandline    || null,
                phoneMobile1:     form.phoneMobile1     || null,
                phoneMobile2:     form.phoneMobile2     || null,
                emailFather:      form.emailFather      || null,
                emailMother:      form.emailMother      || null,
                address:          form.address          || null,
                guardian:         form.guardian         || null,
                admissionDate:    form.admissionDate    || null,
                withdrawalDate:   form.withdrawalDate   || null,
                withdrawalReason: form.withdrawalReason || null,
                observations:     form.observations     || null,
                documents:        Array.isArray(form.documents) ? form.documents : [],
            };
            if (form.id) {
                await api.put(`/students/${form.id}`, payload);
                setMessage({ type: 'success', text: 'Estudiante actualizado' });
            } else {
                await api.post('/students', payload);
                setMessage({ type: 'success', text: 'Estudiante creado' });
            }
            setForm({
                id: '', lastName: '', firstName: '', studentCode: '', birthDate: '',
                documentType: '', documentIssueDate: '', documentIssuePlace: '', documentNumber: '', phoneLandline: '', phoneMobile1: '', phoneMobile2: '',
                emailFather: '', emailMother: '', address: '', guardian: '',
                admissionDate: '', withdrawalDate: '', withdrawalReason: '', observations: '', documents: []
            });
            setFormStep(0);
            refresh();
            setActiveTab('list');
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message;
            if (errorMsg.includes('duplicate') || errorMsg.includes('Ya existe')) {
                setMessage({ type: 'error', text: 'Ya existe un estudiante con este código' });
            } else {
                setMessage({ type: 'error', text: errorMsg });
            }
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleEdit = (student) => {
        setForm({
            id:               student.id,
            lastName:         apellidosDe(student),
            firstName:        nombresDe(student),
            studentCode:      student.student_code      || '',
            birthDate:        student.birth_date        ? student.birth_date.slice(0,10) : '',
            documentType:     student.document_type     || '',
            documentNumber:   student.document_number   || '',
            // Se aceptan las dos formas: la API puede responder en snake_case
            // o en camelCase segun pase o no por camelCaseResponse.
            documentIssueDate:  (student.document_issue_date ?? student.documentIssueDate)
                                  ? String(student.document_issue_date ?? student.documentIssueDate).slice(0, 10) : '',
            documentIssuePlace: student.document_issue_place ?? student.documentIssuePlace ?? '',
            phoneLandline:    student.phone_landline    || '',
            phoneMobile1:     student.phone_mobile1     || '',
            phoneMobile2:     student.phone_mobile2     || '',
            emailFather:      student.email_father      || '',
            emailMother:      student.email_mother      || '',
            address:          student.address           || '',
            guardian:         student.guardian          || '',
            admissionDate:    student.admission_date    ? student.admission_date.slice(0,10) : '',
            withdrawalDate:   student.withdrawal_date   ? student.withdrawal_date.slice(0,10) : '',
            withdrawalReason: student.withdrawal_reason || '',
            observations:     student.observations      || '',
            documents:        Array.isArray(student.documents) ? student.documents : [],
        });
        setFormStep(0);
        setActiveTab('create');
    };

    const handleDeleteClick = (id) => {
        setStudentToDelete(id);
        setShowConfirm(true);
    };

    const confirmDelete = async () => {
        if (studentToDelete) {
            setLoading(true);
            try {
                // 1. Obtener las matrículas del estudiante
                const enrollmentsRes = await api.get(`/enrollments?studentId=${studentToDelete}`);
                const enrollments = Array.isArray(enrollmentsRes.data) ? enrollmentsRes.data : (enrollmentsRes.data.data || []);

                // 2. Eliminar cada matrícula (soft delete)
                for (const enrollment of enrollments) {
                    await api.delete(`/enrollments/${enrollment.id}`);
                }

                // 3. Eliminar el estudiante (soft delete)
                await api.delete(`/students/${studentToDelete}`);

                setMessage({ type: 'success', text: 'Estudiante y sus matrículas eliminados' });
                loadStudents(false);
            } catch (err) {
                console.error('Error al eliminar:', err);
                setMessage({ type: 'error', text: err.response?.data?.message || 'Error al eliminar' });
            } finally {
                setLoading(false);
                setTimeout(() => setMessage(null), 3000);
            }
        }
        setShowConfirm(false);
        setStudentToDelete(null);
    };

    const cancelDelete = () => setShowConfirm(false);

    const goToPage = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
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
                    {form.id ? 'Editar estudiante' : 'Crear estudiante'}
                </button>
                <button
                    onClick={() => setActiveTab('list')}
                    className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                        activeTab === 'list'
                            ? 'border-blue-700 text-blue-700'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    Listado de estudiantes
                </button>
            </div>

            {activeTab === 'create' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 card-hover">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <div className="flex items-center justify-between">
                            <h2 className="text-[15px] font-semibold text-gray-800">
                                {form.id ? 'Editar estudiante' : 'Crear estudiante'}
                            </h2>
                            {/* Indicador de pasos */}
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setFormStep(0)}
                                    className={`px-3 py-1 text-xs rounded-full font-medium transition ${
                                        formStep === 0 ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    }`}
                                >1. Datos Básicos</button>
                                <button
                                    type="button"
                                    onClick={() => { if (form.lastName && form.firstName) setFormStep(1); }}
                                    className={`px-3 py-1 text-xs rounded-full font-medium transition ${
                                        formStep === 1 ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    }`}
                                >2. Datos Complementarios</button>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-4">

                        {/* ── PASO 1: Datos básicos ─────────────────────────── */}
                        {formStep === 0 && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Apellidos primero: mismo orden que las listas y los informes */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-1">Apellidos *</label>
                                        <input
                                            type="text"
                                            value={form.lastName}
                                            onChange={e => setForm({ ...form, lastName: e.target.value })}
                                            placeholder="Ej: PÉREZ GÓMEZ"
                                            maxLength={80}
                                            required
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-1">Nombres *</label>
                                        <input
                                            type="text"
                                            value={form.firstName}
                                            onChange={e => setForm({ ...form, firstName: e.target.value })}
                                            placeholder="Ej: JUAN ANDRÉS"
                                            maxLength={80}
                                            required
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-1">
                                            Código de estudiante {!form.id && <span className="text-xs text-blue-500">(auto-generado)</span>}
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={form.studentCode}
                                                readOnly={!form.id}
                                                onChange={form.id ? e => setForm({ ...form, studentCode: e.target.value.toUpperCase() }) : undefined}
                                                placeholder={codeLoading ? 'Generando...' : ''}
                                                className={`w-full px-3 py-2 border border-gray-200 rounded-lg outline-none text-sm ${!form.id ? 'bg-gray-50 text-gray-500 cursor-default' : 'focus:ring-1 focus:ring-blue-500'}`}
                                            />
                                            {!form.id && (
                                                <button type="button" onClick={fetchNextCode}
                                                    className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg border border-gray-200 transition whitespace-nowrap"
                                                    title="Regenerar código">
                                                    ↺
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-1">Tipo de documento</label>
                                        <select
                                            value={form.documentType}
                                            onChange={e => setForm({ ...form, documentType: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                        >
                                            <option value="">Seleccionar...</option>
                                            <option value="R.C.">R.C. — Registro Civil</option>
                                            <option value="T.I.">T.I. — Tarjeta de Identidad</option>
                                            <option value="C.C.">C.C. — Cédula de Ciudadanía</option>
                                            <option value="P.E.">P.E. — Permiso Especial-Intercambio</option>
                                            <option value="NIT">NIT</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-1">Número de documento</label>
                                        <input
                                            type="text"
                                            value={form.documentNumber || ''}
                                            onChange={e => setForm({ ...form, documentNumber: e.target.value })}
                                            placeholder="Ej: 1059243008"
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-1">Fecha de nacimiento</label>
                                        <CampoFecha
                                            value={form.birthDate || ''}
                                            onChange={v => setForm({ ...form, birthDate: v })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-1">Fecha de ingreso al colegio</label>
                                        <CampoFecha
                                            value={form.admissionDate}
                                            onChange={v => setForm({ ...form, admissionDate: v })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-1">Acudiente</label>
                                        <input
                                            type="text"
                                            value={form.guardian}
                                            onChange={e => setForm({ ...form, guardian: e.target.value })}
                                            placeholder="Nombre del acudiente"
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => { if (form.lastName && form.firstName) setFormStep(1); else setMessage({ type:'error', text:'Los apellidos y los nombres son obligatorios' }); }}
                                        className="bg-blue-700 hover:bg-blue-800 text-white font-medium py-2 px-6 rounded-lg transition text-sm"
                                    >
                                        Siguiente →
                                    </button>
                                </div>
                            </>
                        )}

                        {/* ── PASO 2: Datos complementarios ─────────────────── */}
                        {formStep === 1 && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-1">Fecha de expedición del documento</label>
                                        <CampoFecha value={form.documentIssueDate}
                                            onChange={v => setForm({ ...form, documentIssueDate: v })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-1">Lugar de expedición del documento</label>
                                        <input type="text" value={form.documentIssuePlace}
                                            onChange={e => setForm({ ...form, documentIssuePlace: e.target.value })}
                                            placeholder="Ej: Popayán, Cauca"
                                            maxLength={120}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-1">Teléfono fijo</label>
                                        <input type="text" value={form.phoneLandline}
                                            onChange={e => setForm({ ...form, phoneLandline: e.target.value })}
                                            placeholder="Ej: 6043221234"
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-1">Celular del padre</label>
                                        <input type="tel" value={form.phoneMobile1}
                                            onChange={e => setForm({ ...form, phoneMobile1: e.target.value })}
                                            placeholder="Ej: 3001234567"
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-1">Celular de la madre</label>
                                        <input type="tel" value={form.phoneMobile2}
                                            onChange={e => setForm({ ...form, phoneMobile2: e.target.value })}
                                            placeholder="Ej: 3009876543"
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-1">Correo del padre</label>
                                        <input type="email" value={form.emailFather}
                                            onChange={e => setForm({ ...form, emailFather: e.target.value })}
                                            placeholder="padre@ejemplo.com"
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-1">Correo de la madre</label>
                                        <input type="email" value={form.emailMother}
                                            onChange={e => setForm({ ...form, emailMother: e.target.value })}
                                            placeholder="madre@ejemplo.com"
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-1">Dirección de residencia</label>
                                        <input type="text" value={form.address}
                                            onChange={e => setForm({ ...form, address: e.target.value })}
                                            placeholder="Ej: Cra 23 # 05-12"
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-1">Fecha de retiro</label>
                                        <CampoFecha value={form.withdrawalDate}
                                            onChange={v => setForm({ ...form, withdrawalDate: v })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-1">Motivo del retiro</label>
                                        <input type="text" value={form.withdrawalReason}
                                            onChange={e => setForm({ ...form, withdrawalReason: e.target.value })}
                                            placeholder="Motivo del retiro (si aplica)"
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-1">Observaciones</label>
                                    <textarea
                                        value={form.observations}
                                        onChange={e => setForm({ ...form, observations: e.target.value })}
                                        placeholder="Información adicional relevante del estudiante"
                                        rows={3}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm resize-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-2">
                                        Documentos entregados <span className="text-gray-400 font-normal">({(form.documents || []).length} de {STUDENT_DOCS.length})</span>
                                    </label>
                                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                                        {STUDENT_DOCS.map(d => {
                                            const has = (form.documents || []).includes(d.code);
                                            return (
                                                <label key={d.code} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                                    <input type="checkbox" checked={has}
                                                        onChange={() => setForm(f => ({
                                                            ...f,
                                                            documents: has
                                                                ? (f.documents || []).filter(c => c !== d.code)
                                                                : [...(f.documents || []), d.code]
                                                        }))}
                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                                    {d.label}
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setFormStep(0)}
                                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-5 rounded-lg transition text-sm"
                                    >← Anterior</button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="bg-blue-700 hover:bg-blue-800 text-white font-medium py-2 px-5 rounded-lg transition disabled:opacity-50 text-sm"
                                    >
                                        {loading ? 'Guardando...' : (form.id ? 'Actualizar' : 'Crear')}
                                    </button>
                                    {form.id && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setForm({ id: '', lastName: '', firstName: '', studentCode: '',
                                                    documentType: '', documentIssueDate: '', documentIssuePlace: '', documentNumber: '', phoneLandline: '', phoneMobile1: '', phoneMobile2: '',
                                                    emailFather: '', emailMother: '', address: '', guardian: '',
                                                    admissionDate: '', withdrawalDate: '', withdrawalReason: '', observations: ''
                                                });
                                                setFormStep(0);
                                                setActiveTab('list');
                                            }}
                                            className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-5 rounded-lg transition text-sm"
                                        >Cancelar</button>
                                    )}
                                </div>
                            </>
                        )}
                    </form>
                </div>
            )}

            {activeTab === 'list' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 card-hover overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-wrap justify-between items-center gap-3">
                        <h2 className="text-[15px] font-semibold text-gray-800">Listado de estudiantes</h2>
                        <div className="flex items-center gap-3">
                            <input
                                type="text"
                                value={search}
                                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                                placeholder="Buscar por nombre..."
                                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none w-52"
                            />
                            <span className="text-xs text-gray-400">{filteredStudents.length} estudiante{filteredStudents.length !== 1 ? 's' : ''}</span>
                            <button onClick={loadStudents} className="text-gray-500 hover:text-gray-700 text-sm transition">
                                Actualizar
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Documentos</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {currentStudents.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="px-5 py-8 text-center text-gray-400 text-sm">
                                            No hay estudiantes registrados
                                        </td>
                                    </tr>
                                ) : (
                                    currentStudents.map((student) => (
                                        <tr key={student.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-5 py-3 font-medium text-gray-800">{student.full_name}</td>
                                            <td className="px-5 py-3">
                                                <span className="text-gray-600">{student.student_code}</span>
                                            </td>
                                            <td className="px-5 py-3">
                                                {(() => {
                                                    const docs = Array.isArray(student.documents) ? student.documents : [];
                                                    return (
                                                        <div className="flex flex-wrap gap-1">
                                                            {STUDENT_DOCS.map(d => {
                                                                const has = docs.includes(d.code);
                                                                return (
                                                                    <span key={d.code}
                                                                        title={has ? `${d.label}: entregado` : `${d.label}: falta`}
                                                                        className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${has ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400 line-through'}`}>
                                                                        {d.label}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleEdit(student)}
                                                        className="text-blue-700 hover:text-blue-700 text-sm font-medium transition"
                                                    >
                                                        Editar
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteClick(student.id)}
                                                        className="text-red-400 hover:text-red-500 text-sm font-medium transition"
                                                    >
                                                        Eliminar
                                                    </button>
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
                        let start = Math.max(1, currentPage - half);
                        let end   = Math.min(totalPages, start + WINDOW - 1);
                        if (end - start < WINDOW - 1) start = Math.max(1, end - WINDOW + 1);
                        const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
                        return (
                            <div className="flex justify-center items-center gap-1 py-4 border-t border-gray-100 bg-gray-50/50 flex-wrap">
                                <button
                                    onClick={() => goToPage(1)}
                                    disabled={currentPage === 1}
                                    className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                >«</button>
                                <button
                                    onClick={() => goToPage(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                >Anterior</button>

                                {start > 1 && <span className="px-1 text-xs text-gray-400">…</span>}

                                {pages.map(page => (
                                    <button
                                        key={page}
                                        onClick={() => goToPage(page)}
                                        className={`w-7 h-7 text-xs rounded-md transition ${
                                            currentPage === page
                                                ? 'bg-blue-700 text-white font-semibold'
                                                : 'text-gray-600 hover:bg-gray-100'
                                        }`}
                                    >{page}</button>
                                ))}

                                {end < totalPages && <span className="px-1 text-xs text-gray-400">…</span>}

                                <button
                                    onClick={() => goToPage(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                >Siguiente</button>
                                <button
                                    onClick={() => goToPage(totalPages)}
                                    disabled={currentPage === totalPages}
                                    className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                >»</button>
                            </div>
                        );
                    })()}
                </div>
            )}

            <ConfirmDialog
                isOpen={showConfirm}
                onClose={cancelDelete}
                onConfirm={confirmDelete}
                title="Eliminar estudiante"
                message="¿Estás seguro de que deseas eliminar este estudiante? Esta acción también eliminará todas sus matrículas."
                confirmText="Eliminar"
                cancelText="Cancelar"
            />
        </div>
    );
};

export default Students;

