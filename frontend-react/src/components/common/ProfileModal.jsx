import { useState, useEffect } from 'react';
import api from '../../api/client';

const ProfileModal = ({ onClose }) => {
    const [profile, setProfile] = useState(null);
    const [form, setForm] = useState({ name: '', document: '', email: '', phone: '' });
    const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [tab, setTab] = useState('info');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        api.get('/auth/me').then(r => {
            setProfile(r.data);
            setForm({
                name: r.data.name || '',
                document: r.data.document || '',
                email: r.data.email || '',
                phone: r.data.phone || '',
            });
        }).catch(() => {});
    }, []);

    const notify = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 3000);
    };

    const handleSaveInfo = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.put('/auth/me', form);
            notify('success', 'Datos actualizados correctamente');
            setProfile(prev => ({ ...prev, ...form }));
        } catch (err) {
            notify('error', err.response?.data?.message || 'Error al actualizar');
        } finally {
            setLoading(false);
        }
    };

    const handleSavePassword = async (e) => {
        e.preventDefault();
        if (pwForm.newPassword !== pwForm.confirmPassword) {
            return notify('error', 'Las contraseñas nuevas no coinciden');
        }
        if (pwForm.newPassword.length < 6) {
            return notify('error', 'La contraseña debe tener al menos 6 caracteres');
        }
        setLoading(true);
        try {
            await api.put('/auth/me', {
                ...form,
                currentPassword: pwForm.currentPassword,
                newPassword: pwForm.newPassword,
            });
            notify('success', 'Contraseña actualizada correctamente');
            setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            notify('error', err.response?.data?.message || 'Error al cambiar contraseña');
        } finally {
            setLoading(false);
        }
    };

    const roleLabel = profile?.role === 'admin' ? 'Administrador' : 'Docente';

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" style={{position:'fixed',top:0,left:0,right:0,bottom:0}} onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center text-white font-bold text-sm">
                            {profile?.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-800">{profile?.name || '...'}</p>
                            <p className="text-xs text-gray-400">{roleLabel}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100">
                    {[{ id: 'info', label: 'Mis datos' }, { id: 'password', label: 'Cambiar contraseña' }].map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                                tab === t.id ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Message */}
                {message && (
                    <div className={`mx-6 mt-4 px-3 py-2 rounded-lg text-sm border ${
                        message.type === 'success'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                        {message.text}
                    </div>
                )}

                {/* Info tab */}
                {tab === 'info' && (
                    <form onSubmit={handleSaveInfo} className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Nombre completo</label>
                            <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Documento</label>
                            <input type="text" value={form.document} onChange={e => setForm({...form, document: e.target.value})} required
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Correo electronico</label>
                            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Telefono</label>
                            <input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                placeholder="Opcional" />
                        </div>
                        <button type="submit" disabled={loading}
                            className="w-full bg-blue-700 hover:bg-blue-800 text-white font-medium py-2 px-5 rounded-lg transition disabled:opacity-50 text-sm">
                            {loading ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                    </form>
                )}

                {/* Password tab */}
                {tab === 'password' && (
                    <form onSubmit={handleSavePassword} className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Contraseña actual</label>
                            <input type="password" value={pwForm.currentPassword}
                                onChange={e => setPwForm({...pwForm, currentPassword: e.target.value})} required
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                placeholder="Tu contraseña actual" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Nueva contraseña</label>
                            <input type="password" value={pwForm.newPassword}
                                onChange={e => setPwForm({...pwForm, newPassword: e.target.value})} required
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                placeholder="Minimo 6 caracteres" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Confirmar nueva contraseña</label>
                            <input type="password" value={pwForm.confirmPassword}
                                onChange={e => setPwForm({...pwForm, confirmPassword: e.target.value})} required
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                placeholder="Repite la nueva contraseña" />
                        </div>
                        <button type="submit" disabled={loading}
                            className="w-full bg-blue-700 hover:bg-blue-800 text-white font-medium py-2 px-5 rounded-lg transition disabled:opacity-50 text-sm">
                            {loading ? 'Cambiando...' : 'Cambiar contraseña'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ProfileModal;
