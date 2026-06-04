import React, { useState, useMemo } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusChip } from '../components/ui/StatusChip';
import { Modal } from '../components/ui/Modal';
import { Search, Download, Eye, MapPin, Activity, Trash2 } from 'lucide-react';
import type { Log } from '../types';
import API_BASE from '../api';

/**
 * Logs Component
 * 
 * Renders database verification event entries. Enables real-time
 * query matching (ID, worker name, device metadata) and status filtration (Success,
 * Failed, Spoof Alert) to monitor system performance and audit spoof attempts.
 */
export const Logs: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Track selected log for detailed inspect modal
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);
  
  // Holds all biometric access logs retrieved from database
  const [logs, setLogs] = useState<Log[]>([]);

  /**
   * Retrieves log feed data from the FastAPI REST endpoint.
   */
  const fetchLogs = () => {
    fetch(`${API_BASE}/api/logs`)
      .then(res => res.json())
      .then(data => setLogs(data))
      .catch(err => console.error('Error fetching logs:', err));
  };

  // Fetch telemetry logs on view mount
  React.useEffect(() => {
    fetchLogs();
  }, []);

  /**
   * Deletes a verification event record from the PostgreSQL database.
   */
  const handleDeleteLog = async (logId: string) => {
    if (!window.confirm(`Are you sure you want to delete log ${logId}?`)) return;
    try {
      const response = await fetch(`${API_BASE}/api/logs/${logId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchLogs();
      } else {
        alert('Failed to delete log.');
      }
    } catch (err) {
      console.error('Error deleting log:', err);
      alert('Error connecting to backend server.');
    }
  };

  /**
   * Returns a filtered array of logs matching query string and status criteria.
   */
  const filteredLogs = useMemo(() => {
    const dataToFilter = logs;
    return dataToFilter.filter(log => {
      const matchesSearch = 
        log.worker.toLowerCase().includes(searchQuery.toLowerCase()) || 
        log.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.device.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.worker_id && log.worker_id.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesStatus = statusFilter === 'All' || log.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, statusFilter, logs]);

  const handleExport = () => {
    alert("Exporting logs to CSV...");
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ marginBottom: 'var(--spacing-xs)' }}>Authentication Logs</h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>Review all system authentications and security events.</p>
        </div>
        <Button variant="secondary" icon={<Download size={18} />} onClick={handleExport}>Export Logs</Button>
      </div>

      <Card style={{ padding: 'var(--spacing-sm) var(--spacing-lg)' }}>
        <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', background: 'var(--color-background)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', flex: 1, border: '1px solid var(--color-border)' }}>
            <Search size={16} color="var(--color-text-secondary)" />
            <input 
              type="text" 
              placeholder="Search by ID, worker, or device..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.8125rem' }} 
            />
          </div>
          
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '6px var(--spacing-md)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              fontSize: '0.8125rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="All">Status: All</option>
            <option value="Success">Success</option>
            <option value="Failed">Failed</option>
            <option value="Spoof Attempt">Spoof Attempt</option>
          </select>
        </div>
      </Card>

      <Card style={{ padding: 0, overflow: 'visible' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--color-background)', borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ padding: 'var(--spacing-md) var(--spacing-lg)', fontWeight: 600, fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>Timestamp</th>
              <th style={{ padding: 'var(--spacing-md) var(--spacing-lg)', fontWeight: 600, fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>Worker</th>
              <th style={{ padding: 'var(--spacing-md) var(--spacing-lg)', fontWeight: 600, fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>Type</th>
              <th style={{ padding: 'var(--spacing-md) var(--spacing-lg)', fontWeight: 600, fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>Device</th>
              <th style={{ padding: 'var(--spacing-md) var(--spacing-lg)', fontWeight: 600, fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>Status</th>
              <th style={{ padding: 'var(--spacing-md) var(--spacing-lg)', fontWeight: 600, fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((log) => (
              <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: 'var(--spacing-md) var(--spacing-lg)', fontSize: '0.8125rem' }}>{log.time}</td>
                <td style={{ padding: 'var(--spacing-md) var(--spacing-lg)', fontWeight: 500, fontSize: '0.875rem' }}>
                  {log.worker}
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)', fontWeight: 400 }}>{log.id}</div>
                </td>
                <td style={{ padding: 'var(--spacing-md) var(--spacing-lg)', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{log.type}</td>
                <td style={{ padding: 'var(--spacing-md) var(--spacing-lg)', fontSize: '0.8125rem' }}>{log.device}</td>
                <td style={{ padding: 'var(--spacing-md) var(--spacing-lg)' }}>
                  <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
                    <StatusChip 
                      status={log.status === 'Success' ? 'success' : log.status === 'Spoof Attempt' ? 'error' : 'warning'} 
                      label={log.status} 
                    />
                    {log.sync === 'pending' && <StatusChip status="neutral" label="Pending Sync" />}
                  </div>
                </td>
                <td style={{ padding: 'var(--spacing-md) var(--spacing-lg)', display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center' }}>
                  <button onClick={() => setSelectedLog(log)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', display: 'flex' }}>
                    <Eye size={18} />
                  </button>
                  <button onClick={() => handleDeleteLog(log.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-error)', display: 'flex' }}>
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  No logs found matching your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Log Details Modal */}
      <Modal isOpen={!!selectedLog} onClose={() => setSelectedLog(null)} title="Authentication Details">
        {selectedLog && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
              <div style={{ padding: 'var(--spacing-md)', backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-sm)' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Event ID</p>
                <p style={{ fontWeight: 600 }}>{selectedLog.id}</p>
              </div>
              <div style={{ padding: 'var(--spacing-md)', backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-sm)' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Timestamp</p>
                <p style={{ fontWeight: 600 }}>{selectedLog.time}</p>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--spacing-md)' }}>
              <h4 style={{ marginBottom: 'var(--spacing-sm)' }}>Biometric Telemetry</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}><Activity size={14} /> Confidence Score</span>
                  <span style={{ fontWeight: 600, color: selectedLog.status === 'Success' ? 'var(--color-success)' : 'var(--color-error)' }}>
                    {selectedLog.details.confidence}
                  </span>
                </div>
                {selectedLog.details.duration && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Processing Time</span>
                    <span style={{ fontWeight: 500 }}>{selectedLog.details.duration}</span>
                  </div>
                )}
                {selectedLog.details.error && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Rejection Reason</span>
                    <span style={{ fontWeight: 500, color: 'var(--color-error)' }}>{selectedLog.details.error}</span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--spacing-md)' }}>
              <h4 style={{ marginBottom: 'var(--spacing-sm)' }}>Location Context</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', padding: 'var(--spacing-md)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
                <MapPin size={20} color="var(--color-text-secondary)" />
                <div>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{selectedLog.device}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{selectedLog.details.lat}, {selectedLog.details.lng}</p>
                </div>
              </div>
            </div>

          </div>
        )}
      </Modal>
    </div>
  );
};
