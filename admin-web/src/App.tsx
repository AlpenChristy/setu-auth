import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { Dashboard } from './pages/Dashboard';
import { Workers } from './pages/Workers';
import { Logs } from './pages/Logs';
import { Attendance } from './pages/Attendance';
// import { Sync } from './pages/Sync';
// import { Enrollment } from './pages/Enrollment';
// import { Reports, Settings } from './pages/ReportsSettings';
import { Login } from './pages/Login';
import { LandingPage } from './pages/LandingPage';

/**
 * App Component
 * 
 * Root routing manager. Directs users to the public landing page, the administrative
 * login form, or the nested authenticated dashboard view routes based on session state.
 */
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('isAdminAuthenticated') === 'true';
  });

  const handleLogin = () => {
    localStorage.setItem('isAdminAuthenticated', 'true');
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('isAdminAuthenticated');
    setIsAuthenticated(false);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login onLogin={handleLogin} />
        } />
        
        <Route path="/dashboard" element={
          isAuthenticated ? <DashboardLayout onLogout={handleLogout} /> : <Navigate to="/login" replace />
        }>
          <Route index element={<Dashboard />} />
          <Route path="workers" element={<Workers />} />
          {/* <Route path="enrollment" element={<Enrollment />} /> */}
          <Route path="logs" element={<Logs />} />
          <Route path="attendance" element={<Attendance />} />
          {/* <Route path="sync" element={<Sync />} /> */}
          {/* <Route path="reports" element={<Reports />} /> */}
          {/* <Route path="settings" element={<Settings />} /> */}
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
