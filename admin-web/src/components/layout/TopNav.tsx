import React, { useState } from 'react';
import { Search, Cloud, LogOut } from 'lucide-react';
import { format } from 'date-fns';
import { StatusChip } from '../ui/StatusChip';
import './layout.css';

interface TopNavProps {
  onLogout: () => void;
}

/**
 * TopNav Component
 * 
 * Header utility panel providing global keyword searches across worker profiles,
 * cloud synchronization indicators, and popovers displaying active spoof alerts.
 */
export const TopNav: React.FC<TopNavProps> = ({ onLogout }) => {
  const currentDate = format(new Date(), 'EEEE, MMM dd, yyyy');
  
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="topnav">
      <div className="topnav-left" style={{ position: 'relative' }}>
        <div className={`topnav-search ${isSearchActive ? 'active' : ''}`} style={{ border: isSearchActive ? '1px solid var(--color-primary)' : '1px solid var(--color-border)' }}>
          <Search size={18} color={isSearchActive ? "var(--color-primary)" : "var(--color-text-secondary)"} />
          <input 
            type="text" 
            placeholder="Search workers, logs..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchActive(true)}
            onBlur={() => setTimeout(() => setIsSearchActive(false), 200)}
            style={{ width: isSearchActive ? '300px' : '250px', transition: 'width 0.2s ease' }}
          />
        </div>
        
        {/* Global Search Results Dropdown */}
        {isSearchActive && searchQuery && (
          <div className="dropdown-menu" style={{ position: 'absolute', top: '100%', left: 0, width: '400px', marginTop: 8, padding: 'var(--spacing-sm)', zIndex: 100 }}>
            <p style={{ padding: 'var(--spacing-xs) var(--spacing-sm)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Workers</p>
            <div className="dropdown-item"><strong>{searchQuery}</strong> Doe - ID: EMP-001</div>
            <div className="dropdown-item">Jane <strong>{searchQuery}</strong> - ID: EMP-002</div>
            <p style={{ padding: 'var(--spacing-xs) var(--spacing-sm)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 'var(--spacing-sm)' }}>Logs</p>
            <div className="dropdown-item" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Auth success for <strong>{searchQuery}</strong></span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>2 mins ago</span>
            </div>
          </div>
        )}
      </div>

      <div className="topnav-right">
        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
          {currentDate}
        </span>
        
        <div className="topnav-actions" style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: 'var(--spacing-md)' }}>
          <StatusChip status="success" label="Online" icon={<Cloud size={14} />} />
          
          {/* 
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <button className="action-btn" onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} onBlur={() => setTimeout(() => setIsNotificationsOpen(false), 200)}>
              <Bell size={18} />
              <span style={{ 
                position: 'absolute', top: -2, right: -2, 
                width: 10, height: 10, borderRadius: '50%', 
                backgroundColor: 'var(--color-error)',
                border: '2px solid var(--color-surface)'
              }} />
            </button>
            
            {isNotificationsOpen && (
              <div className="dropdown-menu" style={{ position: 'absolute', top: '100%', right: 0, width: '320px', marginTop: 8, zIndex: 100, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: 'var(--spacing-md)', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                  <h4 style={{ fontSize: '0.875rem' }}>Notifications</h4>
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <div className="dropdown-item" style={{ padding: 'var(--spacing-md)', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'flex-start', borderRadius: 0 }}>
                    <AlertTriangle size={16} color="var(--color-error)" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 500 }}>Spoof Attempt Detected</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>North Gate device blocked a 2D photo attack.</p>
                      <p style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', marginTop: 4 }}>10 mins ago</p>
                    </div>
                  </div>
                  <div className="dropdown-item" style={{ padding: 'var(--spacing-md)', display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'flex-start', borderRadius: 0 }}>
                    <CheckCircle size={16} color="var(--color-success)" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 500 }}>Sync Completed</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>156 logs successfully uploaded to AWS.</p>
                      <p style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', marginTop: 4 }}>1 hour ago</p>
                    </div>
                  </div>
                </div>
                <div style={{ padding: 'var(--spacing-sm)', borderTop: '1px solid var(--color-border)', textAlign: 'center', backgroundColor: 'var(--color-surface)' }}>
                  <button style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer' }}>Mark all as read</button>
                </div>
              </div>
            )}
          </div>
          */}
          
          <button className="action-btn" onClick={onLogout} title="Log Out" style={{ marginLeft: '4px' }}>
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
};
