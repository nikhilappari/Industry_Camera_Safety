import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Video, 
  AlertTriangle, 
  Camera, 
  BarChart3, 
  Settings, 
  LogOut, 
  User as UserIcon,
  LogIn,
  Flame,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Sidebar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/monitoring', label: 'Live Monitoring', icon: Video },
    { to: '/incidents', label: 'Incidents', icon: AlertTriangle },
    { to: '/cameras', label: 'Cameras', icon: Camera },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/admin', label: 'Administration', icon: Settings },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full justify-between">
      <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                isActive
                  ? 'bg-cyan-50 text-cyan-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}

        {/* Dedicated AEGISBURN AI Launcher Entry */}
        <div className="pt-4 mt-4 border-t border-gray-100">
          <NavLink
            to="/aegis-burn"
            className={({ isActive }) =>
              `flex items-center justify-between px-4 py-3 rounded-xl font-semibold transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-gray-900 to-gray-800 text-cyan-300 shadow-md'
                  : 'bg-gradient-to-r from-gray-900 via-slate-900 to-gray-800 text-white hover:from-black hover:to-gray-900 shadow-sm'
              }`
            }
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                <Flame className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-left">
                <span className="block text-xs font-bold tracking-wide">AEGISBURN AI</span>
                <span className="block text-[10px] text-gray-400 font-normal">Data & Anomaly Engine</span>
              </div>
            </div>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
              PRO
            </span>
          </NavLink>
        </div>
      </nav>

      {/* Auth user footer */}
      <div className="p-4 border-t border-gray-100 bg-gray-50/50">
        {isAuthenticated && user ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold text-xs shrink-0">
                {user.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-gray-800 truncate">{user.username}</p>
                <p className="text-[11px] text-gray-500 capitalize truncate">
                  {user.role.replace('_', ' ')}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-cyan-700 bg-cyan-50 hover:bg-cyan-100 rounded-lg transition-colors cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
