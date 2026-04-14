import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      {/* Main Content Area (padding-left accounts for the fixed 64 (16rem) sidebar) */}
      <main className="flex-1 ml-64 min-h-screen border-l border-white/5 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
        <Outlet />
      </main>
    </div>
  );
}
