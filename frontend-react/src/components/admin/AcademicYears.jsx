import { useState, useEffect } from 'react';
import api from '../../api/client';
import ConfirmDialog from '../common/ConfirmDialog';
import { useActiveAcademicYear } from '../../hooks/useActiveAcademicYear';

const AcademicYears = () => {
    const [years, setYears] = useState([]);
    const [form, setForm] = useState({
        id: '',
        name: '',
        startDate: '',
        endDate: '',
        active: false,
        periods: []
    });
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [yearToDelete, setYearToDelete] = useState(null);
    const [showPeriodConfirm, setShowPeriodConfirm] = useState(false);
    const [periodAction, setPeriodAction] = useState({ periodId: null, action: '' });
    const [activeTab, setActiveTab] = useState('create');
    const [editingId, setEditingId] = useState(null);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const [showReopenConfirm, setShowReopenConfirm] = useState(false);
    const [closureLoading, setClosureLoading] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentYears = years.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(years.length / itemsPerPage);

    const { activeYear, refresh: refreshActiveYear } = useActiveAcademicYear();

    const extractData = (response) => {
        if (!response) return [];
        if (Array.isArray(response)) return response;
        if (response.data && Array.isArray(response.data)) return response.data;
        if (response.data && response.data.data && Array.isArray(response.data.data)) return response.data.data;
        return [];
    };

    const formatDate = (date) => {
        if (!date) return '';
        if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) return date;
        try {
            const d = new Date(date);
            if (isNaN(d.getTime())) return '';
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (e) {
            return '';
        }
    };

    const loadYears = async (resetPage = true) => {
        try {
            const res = await api.get('/academic-years');
            const yearsData = extractData(res.data);
            setYears(yearsData);
            if (resetPage) setCurrentPage(1);
        } catch (error) {
            console.error('Error cargando años:', error);
            setYears([]);
        }
    };

    useEffect(() => {
        loadYears();
        refreshActiveYear();
    }, []);

    const recalculateLastPeriod = (periodsList) => {
        if (periodsList.length === 0) return periodsList;
        const lastIndex = periodsList.length - 1;
        let sumOthers = 0;
        for (let i = 0; i < lastIndex; i++) {
            sumOthers += periodsList[i].percentage || 0;
        }
        let lastValue = 100 - sumOthers;
        if (lastValue < 0) lastValue = 0;
        if (lastValue > 100) lastValue = 100;
        const updated = [...periodsList];
        updated[lastIndex] = { ...updated[lastIndex], percentage: Math.round(lastValue * 100) / 100 };
        return updated;
    };

    const handleYearChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handlePeriodChange = (index, field, value) => {
        if (field === 'percentage') {
            const lastIndex = form.periods.length - 1;
            if (index === lastIndex) return;
            let updatedPeriods = [...form.periods];
            let num = parseFloat(value);
            if (isNaN(num)) num = 0;
            num = Math.min(100, Math.max(0, num));
            updatedPeriods[index][field] = num;
            updatedPeriods = recalculateLastPeriod(updatedPeriods);
            setForm(prev => ({ ...prev, periods: updatedPeriods }));
        } else {
            setForm(prev => {
                const updated = [...prev.periods];
                updated[index][field] = value;
                return { ...prev, periods: updated };
            });
        }
    };

    const addPeriod = () => {
        const newOrder = form.periods.length + 1;
        let newPeriods = [
            ...form.periods,
            { name: `Periodo ${newOrder}`, order: newOrder, startDate: '', endDate: '', percentage: 0, status: 'open' }
        ];
        newPeriods = recalculateLastPeriod(newPeriods);
        setForm(prev => ({ ...prev, periods: newPeriods }));
    };

    const removePeriod = (index) => {
        let updated = form.periods.filter((_, i) => i !== index);
        updated.forEach((p, idx) => { p.order = idx + 1; });
        if (updated.length === 1) {
            updated[0].percentage = 100;
        } else {
            updated = recalculateLastPeriod(updated);
        }
        setForm(prev => ({ ...prev, periods: updated }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.startDate || !form.endDate) {
            setMessage({ type: 'error', text: 'Debes completar las fechas de inicio y fin del año lectivo' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }

        setLoading(true);
        setMessage(null);
        try {
            const formattedPeriods = form.periods.map(period => ({
                ...period,
                startDate: formatDate(period.startDate),
                endDate: formatDate(period.endDate)
            }));

            const data = {
                name: form.name,
                startDate: formatDate(form.startDate),
                endDate: formatDate(form.endDate),
                active: form.active,
                periods: formattedPeriods
            };

            if (form.id) {
                await api.put(`/academic-years/${form.id}`, data);
                setMessage({ type: 'success', text: 'Año actualizado' });
            } else {
                await api.post('/academic-years', data);
                setMessage({ type: 'success', text: 'Año creado' });
            }
            setForm({ id: '', name: '', startDate: '', endDate: '', active: false, periods: [] });
            setEditingId(null);
            setActiveTab('list');
            loadYears();
            refreshActiveYear();
        } catch (err) {
            console.error('Error al guardar:', err);
            setMessage({ type: 'error', text: err.response?.data?.message || 'Error al guardar' });
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleEdit = async (year) => {
        setForm({
            id: year.id,
            name: year.name,
            startDate: formatDate(year.startDate),
            endDate: formatDate(year.endDate),
            active: year.active,
            periods: []
        });
        setEditingId(year.id);
        
        try {
            const res = await api.get(`/periods?academicYearId=${year.id}`);
            let periodsData = [];
            
            if (Array.isArray(res.data)) {
                periodsData = res.data;
            } else if (res.data && res.data.data && Array.isArray(res.data.data)) {
                periodsData = res.data.data;
            } else if (res.data && res.data.periods && Array.isArray(res.data.periods)) {
                periodsData = res.data.periods;
            }
            
            const formattedPeriods = periodsData.map(p => ({
                id: p.id,
                name: p.name,
                order: p.order,
                startDate: formatDate(p.startDate || p.start_date),
                endDate: formatDate(p.endDate || p.end_date),
                percentage: p.percentage || 0,
                status: p.status || 'open'
            }));
            
            setForm(prev => ({ ...prev, periods: formattedPeriods }));
            setActiveTab('create');
        } catch (err) {
            console.error('Error cargando periodos:', err);
            setForm(prev => ({ ...prev, periods: [] }));
        }
    };

    const handleDeleteClick = (id) => {
        setYearToDelete(id);
        setShowConfirm(true);
    };

    const confirmDelete = async () => {
        if (yearToDelete) {
            try {
                await api.delete(`/academic-years/${yearToDelete}`);
                loadYears(false);
                refreshActiveYear();
                setMessage({ type: 'success', text: 'Año eliminado' });
            } catch (err) {
                console.error('Error al eliminar:', err);
                setMessage({ type: 'error', text: err.response?.data?.message || 'Error al eliminar' });
            }
            setTimeout(() => setMessage(null), 3000);
        }
        setShowConfirm(false);
        setYearToDelete(null);
    };

    const cancelDelete = () => setShowConfirm(false);

    const confirmClosePeriod = (periodId) => {
        setPeriodAction({ periodId, action: 'close' });
        setShowPeriodConfirm(true);
    };

    const confirmReopenPeriod = (periodId) => {
        setPeriodAction({ periodId, action: 'reopen' });
        setShowPeriodConfirm(true);
    };

    const handlePeriodConfirm = async () => {
        const { periodId, action } = periodAction;
        if (!periodId) return;
        try {
            if (action === 'close') {
                await api.post(`/periods/${periodId}/close`);
                setMessage({ type: 'success', text: 'Periodo cerrado' });
            } else if (action === 'reopen') {
                await api.post(`/periods/${periodId}/reopen`);
                setMessage({ type: 'success', text: 'Periodo reabierto' });
            }
            if (form.id) {
                const res = await api.get(`/periods?academicYearId=${form.id}`);
                let periodsData = [];
                
                if (Array.isArray(res.data)) {
                    periodsData = res.data;
                } else if (res.data && res.data.data && Array.isArray(res.data.data)) {
                    periodsData = res.data.data;
                } else if (res.data && Array.isArray(res.data.periods)) {
                    periodsData = res.data.periods;
                }
                
                const formattedPeriods = periodsData.map(p => ({
                    ...p,
                    startDate: formatDate(p.startDate || p.start_date),
                    endDate: formatDate(p.endDate || p.end_date)
                }));
                setForm(prev => ({ ...prev, periods: formattedPeriods }));
            }
        } catch (err) {
            console.error('Error en operacion:', err);
            setMessage({ type: 'error', text: err.response?.data?.message || 'Error en la operacion' });
        } finally {
            setShowPeriodConfirm(false);
            setPeriodAction({ periodId: null, action: '' });
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleCloseYear = async () => {
        if (!activeYear) return;
        setClosureLoading(true);
        try {
            await api.post(`/academic-years/${activeYear.id}/close`);
            setMessage({ type: 'success', text: `Año ${activeYear.name} cerrado exitosamente` });
            loadYears(false);
            refreshActiveYear();
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.message || 'Error al cerrar el año' });
        } finally {
            setClosureLoading(false);
            setShowCloseConfirm(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleReopenYear = async () => {
        if (!activeYear) return;
        setClosureLoading(true);
        try {
            await api.post(`/academic-years/${activeYear.id}/reopen`);
            setMessage({ type: 'success', text: `Año ${activeYear.name} reabierto exitosamente` });
            loadYears(false);
            refreshActiveYear();
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.message || 'Error al reabrir el año' });
        } finally {
            setClosureLoading(false);
            setShowReopenConfirm(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

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
                    onClick={() => {
                        setActiveTab('create');
                        setEditingId(null);
                    }}
                    className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                        activeTab === 'create'
                            ? 'border-blue-700 text-blue-700'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    {editingId ? 'Editar año' : 'Crear año'}
                </button>
                <button
                    onClick={() => setActiveTab('list')}
                    className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                        activeTab === 'list'
                            ? 'border-blue-700 text-blue-700'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    Listado de años
                </button>
            </div>

            {activeTab === 'create' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 card-hover">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h2 className="text-[15px] font-semibold text-gray-800">
                            {editingId ? 'Editar año lectivo' : 'Crear año lectivo'}
                        </h2>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Nombre</label>
                            <input
                                type="text"
                                name="name"
                                value={form.name}
                                onChange={handleYearChange}
                                placeholder="Ej: 2025-2026"
                                required
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Fecha de inicio</label>
                                <input
                                    type="date"
                                    name="startDate"
                                    value={form.startDate}
                                    onChange={handleYearChange}
                                    required
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Fecha de fin</label>
                                <input
                                    type="date"
                                    name="endDate"
                                    value={form.endDate}
                                    onChange={handleYearChange}
                                    required
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                />
                            </div>
                        </div>

                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                name="active"
                                checked={form.active}
                                onChange={handleYearChange}
                                className="w-4 h-4 rounded border-gray-300"
                            />
                            <span className="text-sm text-gray-700">Activo</span>
                        </label>

                        <div className="border-t pt-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-medium text-gray-700">Periodos del año</h3>
                                <span className="text-xs text-gray-400">{form.periods.length} periodos</span>
                            </div>

                            {form.periods.length === 0 && (
                                <div className="text-center py-6 text-gray-400 text-sm border border-dashed rounded-lg mb-3">
                                    No hay periodos. Haz clic en "Agregar periodo"
                                </div>
                            )}

                            {form.periods.map((p, idx) => {
                                const isLast = idx === form.periods.length - 1;
                                return (
                                    <div key={p.id || idx} className="border border-gray-100 rounded-lg p-3 mb-3 bg-gray-50/50">
                                        <div className="grid grid-cols-2 gap-2 mb-2">
                                            <input
                                                type="text"
                                                value={p.name}
                                                onChange={(e) => handlePeriodChange(idx, 'name', e.target.value)}
                                                placeholder="Nombre"
                                                className="px-2 py-1.5 border border-gray-200 rounded text-sm"
                                            />
                                            <input
                                                type="number"
                                                value={p.order}
                                                onChange={(e) => handlePeriodChange(idx, 'order', parseInt(e.target.value) || 0)}
                                                placeholder="Orden"
                                                className="px-2 py-1.5 border border-gray-200 rounded text-sm"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 mb-2">
                                            <input
                                                type="date"
                                                value={p.startDate}
                                                onChange={(e) => handlePeriodChange(idx, 'startDate', e.target.value)}
                                                className="px-2 py-1.5 border border-gray-200 rounded text-sm"
                                            />
                                            <input
                                                type="date"
                                                value={p.endDate}
                                                onChange={(e) => handlePeriodChange(idx, 'endDate', e.target.value)}
                                                className="px-2 py-1.5 border border-gray-200 rounded text-sm"
                                            />
                                        </div>
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <input
                                                type="text"
                                                value={p.percentage || 0}
                                                onChange={(e) => {
                                                    if (isLast) return;
                                                    let val = e.target.value.replace(/[^0-9.]/g, '');
                                                    let num = parseFloat(val);
                                                    if (isNaN(num)) num = 0;
                                                    handlePeriodChange(idx, 'percentage', num);
                                                }}
                                                placeholder="%"
                                                readOnly={isLast}
                                                className={`w-20 px-2 py-1.5 border border-gray-200 rounded text-sm ${isLast ? 'bg-gray-100 text-gray-500' : ''}`}
                                            />
                                            <span className="text-sm text-gray-500">%</span>
                                            {form.periods.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removePeriod(idx)}
                                                    className="text-red-400 hover:text-red-500 text-sm ml-auto transition"
                                                >
                                                    Eliminar
                                                </button>
                                            )}
                                            {p.id && (
                                                p.status === 'open' ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => confirmClosePeriod(p.id)}
                                                        className="bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded text-xs ml-2 transition"
                                                    >
                                                        Cerrar
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => confirmReopenPeriod(p.id)}
                                                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded text-xs ml-2 transition"
                                                    >
                                                        Reabrir
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            <button
                                type="button"
                                onClick={addPeriod}
                                className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:text-gray-700 hover:border-gray-400 transition"
                            >
                                + Agregar periodo
                            </button>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-blue-700 hover:bg-blue-800 text-white font-medium btn-press py-2 px-5 rounded-lg transition disabled:opacity-50 text-sm"
                            >
                                {loading ? 'Guardando...' : (editingId ? 'Actualizar' : 'Crear')}
                            </button>
                            {editingId && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setForm({ id: '', name: '', startDate: '', endDate: '', active: false, periods: [] });
                                        setEditingId(null);
                                        setActiveTab('list');
                                    }}
                                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-5 rounded-lg transition text-sm"
                                >
                                    Cancelar
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            )}

            {activeTab === 'list' && (
                <div className="space-y-6">
                    {activeYear && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 card-hover p-5">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-[15px] font-semibold text-gray-800">Año lectivo activo</h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                        <strong>{activeYear.name}</strong>
                                        <br />
                                        <span className="text-xs text-gray-500">
                                            Inicio: {activeYear.start_date} | Fin: {activeYear.end_date}
                                        </span>
                                    </p>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                                    activeYear.active === 1
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-red-100 text-red-700'
                                }`}>
                                    {activeYear.active === 1 ? 'Año abierto' : 'Año cerrado'}
                                </div>
                            </div>
                            <div className="mt-4">
                                {activeYear.active === 1 ? (
                                    <button
                                        onClick={() => setShowCloseConfirm(true)}
                                        disabled={closureLoading}
                                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
                                    >
                                        {closureLoading ? 'Procesando...' : 'Cerrar año lectivo'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setShowReopenConfirm(true)}
                                        disabled={closureLoading}
                                        className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
                                    >
                                        {closureLoading ? 'Procesando...' : 'Reabrir año lectivo'}
                                    </button>
                                )}
                            </div>
                            {activeYear.active === 0 && (
                                <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                                    <p className="text-xs text-amber-700">
                                        Atencion: Este año esta cerrado. Las notas no se pueden modificar.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 card-hover overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <h2 className="text-[15px] font-semibold text-gray-800">Años lectivos</h2>
                            <button onClick={loadYears} className="text-gray-500 hover:text-gray-700 text-sm transition">
                                Actualizar
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inicio</th>
                                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fin</th>
                                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {currentYears.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="px-5 py-8 text-center text-gray-400 text-sm">
                                                No hay años registrados
                                            </td>
                                        </tr>
                                    ) : (
                                        currentYears.map((year) => (
                                            <tr key={year.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-5 py-3 font-medium text-gray-800">{year.name}</td>
                                                <td className="px-5 py-3 text-gray-600">{formatDate(year.startDate)}</td>
                                                <td className="px-5 py-3 text-gray-600">{formatDate(year.endDate)}</td>
                                                <td className="px-5 py-3">
                                                    {year.active === 1 ? (
                                                        <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                            Activo
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                                            Cerrado
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3">
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleEdit(year)}
                                                            className="text-blue-700 hover:text-blue-700 text-sm font-medium transition"
                                                        >
                                                            Editar
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteClick(year.id)}
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
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
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
                </div>
            )}

            <ConfirmDialog
                isOpen={showConfirm}
                onClose={cancelDelete}
                onConfirm={confirmDelete}
                title="Eliminar año lectivo"
                message="¿Estas seguro de que deseas eliminar este año? Tambien se eliminaran sus periodos asociados."
                confirmText="Eliminar"
                cancelText="Cancelar"
            />

            <ConfirmDialog
                isOpen={showPeriodConfirm}
                onClose={() => setShowPeriodConfirm(false)}
                onConfirm={handlePeriodConfirm}
                title={periodAction.action === 'close' ? 'Cerrar periodo' : 'Reabrir periodo'}
                message={
                    periodAction.action === 'close'
                        ? '¿Estas seguro de cerrar este periodo? Las notas no podran modificarse despues.'
                        : '¿Estas seguro de reabrir este periodo? Las notas podran modificarse nuevamente.'
                }
                confirmText={periodAction.action === 'close' ? 'Cerrar' : 'Reabrir'}
                cancelText="Cancelar"
            />

            <ConfirmDialog
                isOpen={showCloseConfirm}
                onClose={() => setShowCloseConfirm(false)}
                onConfirm={handleCloseYear}
                title="Cerrar año lectivo"
                message={`¿Estas seguro de cerrar el año ${activeYear?.name}?
                    
Atencion: Esta accion:
- Bloqueara todas las notas
- No se podran crear nuevas matriculas
- No se podran editar calificaciones
- Los datos historicos se conservaran`}
                confirmText="Cerrar año"
                cancelText="Cancelar"
            />

            <ConfirmDialog
                isOpen={showReopenConfirm}
                onClose={() => setShowReopenConfirm(false)}
                onConfirm={handleReopenYear}
                title="Reabrir año lectivo"
                message={`¿Estas seguro de reabrir el año ${activeYear?.name}?

Atencion: Al reabrir:
- Las notas podran modificarse nuevamente
- Se podran crear nuevas matriculas
- Los periodos no vencidos se reabriran`}
                confirmText="Reabrir año"
                cancelText="Cancelar"
            />
        </div>
    );
};

export default AcademicYears;
