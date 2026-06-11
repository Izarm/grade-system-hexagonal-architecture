import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ProfileModal from '../components/common/ProfileModal';
import DashboardStats from '../components/admin/DashboardStats';
import Students from '../components/admin/Students';
import Enrollments from '../components/admin/Enrollments';
import AcademicYears from '../components/admin/AcademicYears';
import Grades from '../components/admin/Grades';
import Subjects from '../components/admin/Subjects';
import Assignments from '../components/admin/Assignments';
import Queries from '../components/admin/Queries';
import Reports from '../components/admin/Reports';
import Teachers from '../components/admin/Teachers';

const menuSections = [
  {
    title: 'General',
    items: [
      { id: 'dashboard',     label: 'Inicio' },
      { id: 'students',      label: 'Estudiantes' },
      { id: 'enrollments',   label: 'Matrículas' },
    ],
  },
  {
    title: 'Académico',
    items: [
      { id: 'academicYears', label: 'Años lectivos' },
      { id: 'grades',        label: 'Grados' },
      { id: 'subjects',      label: 'Asignaturas' },
      { id: 'assignments',   label: 'Asignaciones' },
    ],
  },
  {
    title: 'Informes',
    items: [
      { id: 'queries',       label: 'Consultas' },
      { id: 'reports',       label: 'Reportes' },
    ],
  },
  {
    title: 'Usuarios',
    items: [
      { id: 'teachers', label: 'Docentes' },
    ],
  },
];

const components = {
  dashboard: DashboardStats, students: Students, enrollments: Enrollments,
  academicYears: AcademicYears, grades: Grades, subjects: Subjects,
  assignments: Assignments, queries: Queries, reports: Reports,
  teachers: Teachers,
};

const allItems = menuSections.flatMap(s => s.items);

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const { user, logout } = useAuth();
  const ActiveComponent = components[activeTab];
  const activeLabel = allItems.find(i => i.id === activeTab)?.label || 'Inicio';

  return (
    <div className="flex min-h-screen bg-slate-100">

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar blanco */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-56 flex flex-col bg-white border-r border-slate-200
        transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:z-30
      `}>

        {/* Logo / nombre */}
        <div className="px-5 py-5 border-b border-slate-100 bg-gradient-to-b from-white to-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-700 flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-white font-bold text-sm">SJ</span>
            </div>
            <div>
              <p className="text-gray-900 font-semibold text-sm leading-tight">San José de Tarbes</p>
              <p className="text-gray-400 text-xs mt-0.5">Administración</p>
            </div>
          </div>
        </div>

        {/* Navegación por secciones */}
        <nav className="flex-1 px-3 py-3 overflow-hidden">
          {menuSections.map((section) => (
            <div key={section.title} className="mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 px-2 mb-1">
                {section.title}
              </p>
              {section.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                  className={`
                    nav-item w-full text-left px-3 py-1.5 rounded text-sm font-medium mb-0.5
                    ${activeTab === item.id
                      ? 'bg-blue-50 text-blue-700 border-l-2 border-blue-700 rounded-l-none'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Usuario */}
        <div className="px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user?.name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{user?.name || 'Usuario'}</p>
              <p className="text-[10px] text-gray-400">Administrador</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="mt-2.5 w-full text-left text-[11px] text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1.5 px-0.5"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex-1 flex flex-col lg:ml-56 min-w-0">

        {/* Topbar */}
        <header className="sticky top-0 z-20 bg-blue-700 border-b border-blue-800 shadow-[0_12px_28px_rgba(29,78,216,0.18)]">
          <div className="flex items-center justify-between px-6 h-13 gap-4" style={{height:'52px'}}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-1.5 rounded text-blue-100 hover:bg-white/10"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="flex items-center gap-2 text-xs text-blue-100/75">
                <span>Administración</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-white font-semibold">{activeLabel}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowProfile(true)}
                className="flex items-center gap-2 hover:bg-white/10 transition px-2 py-1 rounded-lg"
              >
                <span className="text-xs text-blue-50 hidden sm:block">{user?.name}</span>
                <div className="h-7 w-7 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white text-xs font-bold">
                  {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                </div>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-7 overflow-auto">
          {ActiveComponent && (
            <div key={activeTab} className="animate-fade-up">
              <ActiveComponent />
            </div>
          )}
        </main>
      </div>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </div>
  );
};

export default AdminDashboard;
