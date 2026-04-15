import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProcessingProvider } from './context/ProcessingContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import UploadProcess from './pages/UploadProcess';
import OutputGallery from './pages/OutputGallery';
import VideoInsights from './pages/VideoInsights';
import OverspeedAlerts from './pages/OverspeedAlerts';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Signup from './pages/Signup';

// Wrapper for protected routes
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="h-screen bg-background flex flex-col justify-center items-center"><div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin"></div></div>;
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <ProcessingProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="upload" element={<UploadProcess />} />
              <Route path="gallery" element={<OutputGallery />} />
              <Route path="insights" element={<VideoInsights />} />
              <Route path="alerts" element={<OverspeedAlerts />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ProcessingProvider>
    </AuthProvider>
  );
}
