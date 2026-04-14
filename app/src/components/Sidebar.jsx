import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, UploadCloud, GalleryHorizontal, LineChart, AlertTriangle, HelpCircle, LogOut } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../context/AuthContext';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Upload & Process', path: '/upload', icon: UploadCloud },
  { name: 'Output Gallery', path: '/gallery', icon: GalleryHorizontal },
  { name: 'Video Insights', path: '/insights', icon: LineChart },
  { name: 'Overspeed Alerts', path: '/alerts', icon: AlertTriangle },
];

export default function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="w-64 h-screen fixed left-0 top-0 flex flex-col bg-card border-r border-white/5">
      {/* Brand Header */}
      <div className="p-6 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
            <div className="w-4 h-4 bg-primary rounded-sm shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            SpeedSense AI
          </h1>
        </div>
        <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-widest pl-11">Kinetic Intelligence</span>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 mt-6 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.name}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                isActive
                  ? "bg-primary/10 text-primary border-l-2 border-primary"
                  : "text-zinc-400 hover:text-white hover:bg-white/5 border-l-2 border-transparent"
              )}
            >
              <Icon size={18} className={isActive ? "text-primary" : "text-zinc-500 group-hover:text-zinc-300"} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer Area */}
      <div className="p-4 mt-auto mb-4 mx-4 glass-card rounded-xl">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
          <span className="text-xs font-bold text-success tracking-wide">SYSTEM ONLINE</span>
        </div>
        <p className="text-[10px] text-zinc-500">Node Cluster: v2.4.0-delta</p>
      </div>

      <div className="px-6 pb-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold uppercase text-xs">
            {user?.username?.[0] || 'U'}
          </div>
          <div>
            <p className="text-xs font-bold text-white capitalize">{user?.username}</p>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">{user?.role}</p>
          </div>
        </div>

        <button className="flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition w-full">
          <HelpCircle size={16} /> Support
        </button>
        <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-danger hover:text-rose-400 transition w-full">
          <LogOut size={16} /> Disconnect
        </button>
      </div>
    </div>
  );
}
