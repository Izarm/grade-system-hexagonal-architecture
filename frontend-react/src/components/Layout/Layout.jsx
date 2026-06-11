import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ProfileModal from '../common/ProfileModal';
import { 
  Bars3Icon, 
  XMarkIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  AcademicCapIcon,
  CalendarIcon,
  BookOpenIcon,
  UserGroupIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  DocumentTextIcon,
  UserPlusIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

// Modulos del sistema (sin "Grupos" separado)
const navigation = [
  { name: 'Estudiantes y Matrículas', icon: UserGroupIcon, id: 'students' },
  { name: 'Años lectivos', icon: CalendarIcon, id: 'academicYears' },
  { name: 'Grados', icon: ChartBarIcon, id: 'grades' },
  { name: 'Asignaturas', icon: BookOpenIcon, id: 'subjects' },
  { name: 'Asignaciones', icon: ClipboardDocumentListIcon, id: 'assignments' },
  { name: 'Consultas', icon: DocumentTextIcon, id: 'queries' },
  { name: 'Reportes', icon: DocumentTextIcon, id: 'reports' },
  { name: 'Docentes', icon: UserPlusIcon, id: 'teachers' },
];

const Layout = ({ children, title, activeTab, setActiveTab }) => {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-900/80" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
            <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-md text-gray-400 hover:text-gray-500">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <SidebarContent activeTab={activeTab} setActiveTab={setActiveTab} user={user} logout={logout} />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r">
          <SidebarContent activeTab={activeTab} setActiveTab={setActiveTab} user={user} logout={logout} />
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        <div className="sticky top-0 z-40 bg-white border-b shadow-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500">
              <Bars3Icon className="h-6 w-6" />
            </button>
            <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowProfile(true)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-700 transition px-2 py-1 rounded-lg hover:bg-blue-50"
              >
                <span className="hidden sm:inline">{user?.name}</span>
                <div className="w-7 h-7 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-bold">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
              </button>
              <button onClick={logout} className="p-2 text-gray-400 hover:text-red-500 rounded-md">
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
              </button>
            </div>
            {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
          </div>
        </div>
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

const SidebarContent = ({ activeTab, setActiveTab, user, logout }) => {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold text-gray-900">San Jose de Tarbes</h1>
        <p className="text-xs text-gray-500 mt-1">Sistema de Gestion Academica</p>
      </div>
      <nav className="flex-1 py-4 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === item.id
                  ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </button>
          );
        })}
      </nav>
      <div className="p-4 border-t">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">{user?.name || 'Usuario'}</p>
            <p className="text-xs text-gray-500 capitalize">{user?.role === 'admin' ? 'Administrador' : (user?.role === 'docente' ? 'Docente' : user?.role)}</p>
          </div>
          <button onClick={logout} className="p-2 text-gray-400 hover:text-red-500 rounded-md">
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Layout;