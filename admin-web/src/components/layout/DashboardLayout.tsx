import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import './layout.css';

interface DashboardLayoutProps {
  onLogout: () => void;
}

/**
 * DashboardLayout Component
 * 
 * Provides the overall visual structure for authenticated pages. Wraps
 * the Sidebar navigation panel, header TopNav component, and scrollable content router outlet.
 */
export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ onLogout }) => {
  return (
    <div className="layout-container">
      <Sidebar onLogout={onLogout} />
      <div className="main-content">
        <TopNav onLogout={onLogout} />
        <main className="dashboard-scroll">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
