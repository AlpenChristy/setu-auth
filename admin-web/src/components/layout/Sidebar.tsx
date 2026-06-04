import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  CalendarDays,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import './layout.css';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/dashboard/workers', label: 'Workers', icon: Users },
  { path: '/dashboard/logs', label: 'Authentication Logs', icon: ClipboardList },
  { path: '/dashboard/attendance', label: 'Attendance', icon: CalendarDays },
];

interface SidebarProps {
  onLogout?: () => void;
}

/**
 * Sidebar Component
 * 
 * Renders the primary collapsible navigation sidebar containing route links
 * to dashboard views and user logout action links.
 */
export const Sidebar: React.FC<SidebarProps> = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          {!collapsed && <span>SetuAuth</span>}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'flex', marginLeft: collapsed ? 0 : 'auto', alignSelf: 'center' }}
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/dashboard'}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <item.icon size={20} style={{ flexShrink: 0 }} />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-nav" style={{ flex: 'none', borderTop: '1px solid var(--color-border)' }}>
        <a
          href="#"
          className="nav-item"
          title={collapsed ? "Logout" : undefined}
          style={{ color: 'var(--color-error)' }}
          onClick={(e) => {
            e.preventDefault();
            if (onLogout) onLogout();
          }}
        >
          <LogOut size={20} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Logout</span>}
        </a>
      </div>
    </aside>
  );
};
