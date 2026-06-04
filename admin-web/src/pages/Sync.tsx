import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Cloud, AlertCircle, RefreshCw, CheckCircle2, UploadCloud } from 'lucide-react';
import API_BASE from '../api';

/**
 * Sync Component
 * 
 * Manages the synchronisation panel of remote devices. Tracks offline-queued
 * logs, successful pushes, and failed retries, allowing admins to force sync.
 */
export const Sync: React.FC = () => {
  const [pending] = useState(0);
  const [synced, setSynced] = useState(0);
  const [failed, setFailed] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState(0);

  const fetchSyncStats = () => {
    fetch(`${API_BASE}/api/dashboard/stats`)
      .then(res => res.json())
      .then(data => {
        setSynced(data.authentications_today || 0);
        setFailed(data.pending_sync || 0);
      })
      .catch(err => console.error('Error fetching sync stats:', err));
  };

  useEffect(() => {
    fetchSyncStats();
  }, []);

  const handleSync = async () => {
    if (failed === 0) return;
    setIsSyncing(true);
    setProgress(0);

    try {
      const res = await fetch(`${API_BASE}/api/admin/sync/retry`, { method: 'POST' });
      if (!res.ok) throw new Error('Sync retry API failed');
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isSyncing) {
      const interval = setInterval(() => {
        setProgress(p => {
          if (p >= 100) {
            clearInterval(interval);
            setIsSyncing(false);
            fetchSyncStats();
            return 100;
          }
          return Math.min(p + Math.floor(Math.random() * 25) + 5, 100);
        });
      }, 200);
      return () => clearInterval(interval);
    }
  }, [isSyncing, failed]);

  const isAllClear = failed === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <div>
        <h1 style={{ marginBottom: 'var(--spacing-xs)' }}>Sync Management</h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>Manage offline queues and AWS cloud synchronization.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--spacing-md)' }}>
        <Card style={{ padding: 'var(--spacing-md) var(--spacing-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pending Uploads</p>
              <h2 style={{ fontSize: '1.5rem', marginTop: 2, color: 'var(--color-text)' }}>{pending}</h2>
            </div>
            <Cloud size={24} color="var(--color-primary)" opacity={0.8} />
          </div>
        </Card>
        
        <Card style={{ padding: 'var(--spacing-md) var(--spacing-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ color: 'var(--color-success)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Synced Today</p>
              <h2 style={{ fontSize: '1.5rem', marginTop: 2, color: 'var(--color-text)' }}>{synced.toLocaleString()}</h2>
            </div>
            <CheckCircle2 size={24} color="var(--color-success)" opacity={0.8} />
          </div>
        </Card>

        <Card style={{ padding: 'var(--spacing-md) var(--spacing-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ color: 'var(--color-error)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Failed Syncs</p>
              <h2 style={{ fontSize: '1.5rem', marginTop: 2, color: 'var(--color-text)' }}>{failed}</h2>
            </div>
            <AlertCircle size={24} color="var(--color-error)" opacity={0.8} />
          </div>
        </Card>
      </div>

      <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--spacing-xl)' }}>
        {isAllClear ? (
          <CheckCircle2 size={48} color="var(--color-success)" style={{ marginBottom: 'var(--spacing-md)' }} />
        ) : isSyncing ? (
          <RefreshCw size={48} color="var(--color-primary)" className="spin" style={{ marginBottom: 'var(--spacing-md)' }} />
        ) : (
          <UploadCloud size={48} color="var(--color-primary)" style={{ marginBottom: 'var(--spacing-md)', opacity: 0.8 }} />
        )}

        <h3 style={{ marginBottom: 'var(--spacing-xs)', fontSize: '1.25rem' }}>
          {isAllClear ? 'All Systems Synced' : isSyncing ? `Syncing... ${progress}%` : 'System is Online'}
        </h3>
        
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-lg)', textAlign: 'center', maxWidth: 450, minHeight: 40, fontSize: '0.875rem' }}>
          {isAllClear 
            ? 'All device logs and face embeddings have been successfully synchronized with AWS Cloud.' 
            : isSyncing 
            ? 'Please wait while we push local changes to the cloud server and resolve failed entries.'
            : `There are ${pending} records waiting in the offline queue and ${failed} failed retries across 12 devices. You can force a manual sync or wait for the automatic interval.`}
        </p>

        {isSyncing ? (
          <div style={{ width: '100%', maxWidth: 300, height: 6, backgroundColor: 'var(--color-border)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, backgroundColor: 'var(--color-primary)', transition: 'width 0.3s ease' }} />
          </div>
        ) : (
          <Button 
            icon={isAllClear ? <CheckCircle2 size={16} /> : <RefreshCw size={16} />} 
            onClick={handleSync}
            disabled={isAllClear}
            style={{ minWidth: 180 }}
          >
            {isAllClear ? 'Sync Complete' : 'Force Manual Sync'}
          </Button>
        )}
      </Card>
      
      <style>
        {`
          @keyframes spin {
            100% { transform: rotate(360deg); }
          }
          .spin {
            animation: spin 1s linear infinite;
          }
        `}
      </style>
    </div>
  );
};
