import React from 'react';
import { Card } from '../components/ui/Card';
import { Users, UserCheck, CloudUpload, AlertCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { DashboardStats, Log } from '../types';
import API_BASE from '../api';

const CHART_DATA = [
  { name: 'Mon', success: 4000, failed: 240 },
  { name: 'Tue', success: 3000, failed: 139 },
  { name: 'Wed', success: 2000, failed: 980 },
  { name: 'Thu', success: 2780, failed: 390 },
  { name: 'Fri', success: 1890, failed: 480 },
  { name: 'Sat', success: 2390, failed: 380 },
  { name: 'Sun', success: 3490, failed: 430 },
];

/**
 * Dashboard Component
 * 
 * Displays daily operations summary metrics (active personnel, authentication rates,
 * sync errors, spoofing alerts) and charts aggregate authentication volumes over time.
 */
export const Dashboard: React.FC = () => {
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [recentLogs, setRecentLogs] = React.useState<Log[]>([]);

  React.useEffect(() => {
    // Retrieve daily authentication statistics
    fetch(`${API_BASE}/api/dashboard/stats`)
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error('Error fetching dashboard stats:', err));

    // Retrieve the 5 most recent verification logs for the feed
    fetch(`${API_BASE}/api/logs`)
      .then(res => res.json())
      .then(data => setRecentLogs(data.slice(0, 5)))
      .catch(err => console.error('Error fetching recent logs:', err));
  }, []);

  const totalWorkers = stats?.total_workers ?? 0;
  const authsToday = stats?.authentications_today ?? 0;
  const pendingSync = stats?.pending_sync ?? 0;
  const spoofsToday = stats?.spoof_attempts_today ?? 0;
  const chartData = stats?.chart_data && stats.chart_data.length > 0 ? stats.chart_data : CHART_DATA;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
      <div>
        <h1 style={{ marginBottom: 'var(--spacing-xs)' }}>Dashboard Overview</h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>Welcome back, Admin. Here's what's happening today.</p>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--spacing-md)' }}>
        <Card hoverable style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
            <Users size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Total Workers</p>
            <h2 style={{ marginTop: 4 }}>{totalWorkers.toLocaleString()}</h2>
          </div>
        </Card>

        <Card hoverable style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(165, 214, 167, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2E7D32' }}>
            <UserCheck size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Authentications Today</p>
            <h2 style={{ marginTop: 4 }}>{authsToday.toLocaleString()}</h2>
          </div>
        </Card>

        <Card hoverable style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(255, 204, 128, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E65100' }}>
            <CloudUpload size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Failed / Logged Errors</p>
            <h2 style={{ marginTop: 4 }}>{pendingSync.toLocaleString()}</h2>
          </div>
        </Card>

        <Card hoverable style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(239, 154, 154, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C62828' }}>
            <AlertCircle size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Spoof Attempts Today</p>
            <h2 style={{ marginTop: 4 }}>{spoofsToday.toLocaleString()}</h2>
          </div>
        </Card>
      </div>

      {/* Main Content Area */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--spacing-lg)' }}>
        <Card style={{ minHeight: 400, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>Authentication Analytics</h3>
          <div style={{ flex: 1, width: '100%', minHeight: 300 }}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-error)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--color-error)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
                  itemStyle={{ fontSize: 13 }}
                  labelStyle={{ color: 'var(--color-text-secondary)', marginBottom: 4 }}
                />
                <Area type="monotone" dataKey="success" stroke="var(--color-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorSuccess)" name="Successful Auth" />
                <Area type="monotone" dataKey="failed" stroke="var(--color-error)" strokeWidth={2} fillOpacity={1} fill="url(#colorFailed)" name="Failed / Spoof" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card style={{ minHeight: 400 }}>
          <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>Recent Activity</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {recentLogs.map((log: Log) => (
              <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', paddingBottom: 'var(--spacing-md)', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-full)', backgroundColor: log.status === 'Success' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserCheck size={16} color={log.status === 'Success' ? 'var(--color-success)' : 'var(--color-error)'} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                    {log.worker} {log.status === 'Success' ? 'Authenticated' : log.status === 'Spoof Attempt' ? 'Spoof Blocked' : 'Failed Scan'}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{log.time}</p>
                </div>
              </div>
            ))}
            {recentLogs.length === 0 && (
              <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                No recent activity.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
