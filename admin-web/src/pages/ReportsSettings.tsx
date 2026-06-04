import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Download, Filter, Calendar, FileText, RefreshCw, Save, Shield, Bell, Database } from 'lucide-react';
import type { ChartDataPoint, ExportedReport, AttendanceRecord, Log } from '../types';
import API_BASE from '../api';

const MOCK_REPORT_DATA: ChartDataPoint[] = [
  { name: 'Mon', success: 120, failed: 12, spoof: 2 },
  { name: 'Tue', success: 132, failed: 15, spoof: 1 },
  { name: 'Wed', success: 140, failed: 8, spoof: 4 },
  { name: 'Thu', success: 128, failed: 10, spoof: 0 },
  { name: 'Fri', success: 135, failed: 14, spoof: 3 },
  { name: 'Sat', success: 45, failed: 2, spoof: 0 },
  { name: 'Sun', success: 38, failed: 1, spoof: 0 },
];

/**
 * Validates if a calendar date matches the chosen range filter context.
 */
const isWithinRange = (dateStr: string, range: string): boolean => {
  const itemDate = new Date(dateStr);
  if (isNaN(itemDate.getTime())) return true;
  
  itemDate.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (range === 'Last 7 Days') {
    const limit = new Date();
    limit.setDate(now.getDate() - 7);
    limit.setHours(0, 0, 0, 0);
    return itemDate >= limit;
  } else if (range === 'Last 30 Days') {
    const limit = new Date();
    limit.setDate(now.getDate() - 30);
    limit.setHours(0, 0, 0, 0);
    return itemDate >= limit;
  } else if (range === 'This Quarter') {
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const startOfQuarter = new Date(now.getFullYear(), currentQuarter * 3, 1);
    startOfQuarter.setHours(0, 0, 0, 0);
    return itemDate >= startOfQuarter;
  }
  return true;
};

/**
 * Triggers a user browser download for dynamically generated CSV logs.
 */
const downloadCSV = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Reports Component
 * 
 * Compiles visual summaries of daily attendance rates, liveness spoof alerts,
 * and edge sync states. Generates and exports downloadable CSV logs.
 */
export const Reports: React.FC = () => {
  const [reportType, setReportType] = useState('attendance');
  const [dateRange, setDateRange] = useState('Last 7 Days');
  const [isGenerating, setIsGenerating] = useState(false);
  const [chartData, setChartData] = useState<ChartDataPoint[]>(MOCK_REPORT_DATA);
  const [exportsList, setExportsList] = useState<ExportedReport[]>(() => {
    const saved = localStorage.getItem('recent_exports');
    if (saved) return JSON.parse(saved);
    return [
      { id: 1, name: 'Weekly Attendance Summary (Last 7 Days)', date: 'Oct 24, 2023', format: 'CSV', status: 'Ready', csvContent: 'ID,Worker ID,Worker Name,Department,Date,Check In,Check Out,Check In Location,Check Out Location,Status,Working Hours,Created At\nATT-001,EMP001,John Doe,Operations,2023-10-24,09:00 AM,05:00 PM,Main Office,Main Office,present,8.0,2023-10-24T09:00:00Z' },
      { id: 2, name: 'Spoof Attempts Log - Q3 (This Quarter)', date: 'Oct 20, 2023', format: 'CSV', status: 'Ready', csvContent: 'Log ID,Worker,Worker ID,Device,Timestamp,Status,Type,Confidence,Error Details\nLOG-045,Jane Smith,EMP002,iPad-01,2023-10-20 02:30 PM,Spoof Attempt,Face Auth,95%,Liveness Failed (2D Photo)' },
    ];
  });

  useEffect(() => {
    // Fetch telemetry metrics to update the volume chart
    fetch(`${API_BASE}/api/dashboard/stats`)
      .then(res => res.json())
      .then(data => {
        if (data && data.chart_data && data.chart_data.length > 0) {
          setChartData(data.chart_data);
        }
      })
      .catch(err => console.error('Error fetching reports stats:', err));
  }, []);

  /**
   * Compiles SQL dataset tables from the FastAPI backend into CSV spreadsheets
   * based on the currently selected report configurations.
   */
  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      let endpoint = '';
      if (reportType === 'attendance') {
        endpoint = `${API_BASE}/api/attendance`;
      } else {
        endpoint = `${API_BASE}/api/logs`;
      }

      const res = await fetch(endpoint);
      if (!res.ok) throw new Error('Failed to fetch data from backend');
      const rawData = await res.json();

      let csvContent = '';
      let reportName = '';

      if (reportType === 'attendance') {
        const data = rawData as AttendanceRecord[];
        reportName = 'Daily Attendance Log';
        const headers = ["ID", "Worker ID", "Worker Name", "Department", "Date", "Check In", "Check Out", "Check In Location", "Check Out Location", "Status", "Working Hours", "Created At"];
        const csvRows = [headers.join(",")];

        const filtered = data.filter((item: AttendanceRecord) => isWithinRange(item.date, dateRange));
        
        filtered.forEach((item: AttendanceRecord) => {
          const row = [
            item.id,
            item.worker_id,
            `"${(item.worker_name || '').replace(/"/g, '""')}"`,
            `"${(item.department || '').replace(/"/g, '""')}"`,
            item.date,
            item.check_in || "",
            item.check_out || "",
            `"${(item.check_in_location || '').replace(/"/g, '""')}"`,
            `"${(item.check_out_location || '').replace(/"/g, '""')}"`,
            item.status,
            item.working_hours || 0,
            item.created_at
          ];
          csvRows.push(row.join(","));
        });
        csvContent = csvRows.join("\n");

      } else if (reportType === 'spoof') {
        const data = rawData as Log[];
        reportName = 'Biometric Spoof Attempts';
        const headers = ["Log ID", "Worker", "Worker ID", "Device", "Timestamp", "Status", "Type", "Confidence", "Error Details"];
        const csvRows = [headers.join(",")];

        const spoofLogs = data.filter((item: Log) => item.status === "Spoof Attempt");
        const filtered = spoofLogs.filter((item: Log) => {
          const datePart = item.time.split(' ')[0];
          return isWithinRange(datePart, dateRange);
        });

        filtered.forEach((item: Log) => {
          const row = [
            item.id,
            `"${(item.worker || '').replace(/"/g, '""')}"`,
            item.worker_id || "",
            item.device || "",
            item.time,
            item.status,
            item.type,
            item.details?.confidence || "",
            `"${(item.details?.error || '').replace(/"/g, '""')}"`
          ];
          csvRows.push(row.join(","));
        });
        csvContent = csvRows.join("\n");

      } else {
        const data = rawData as Log[];
        reportName = 'Hardware Sync Health';
        const headers = ["Log ID", "Worker", "Worker ID", "Device", "Timestamp", "Type", "Sync Status"];
        const csvRows = [headers.join(",")];

        const filtered = data.filter((item: Log) => {
          const datePart = item.time.split(' ')[0];
          return isWithinRange(datePart, dateRange);
        });

        filtered.forEach((item: Log) => {
          const row = [
            item.id,
            `"${(item.worker || '').replace(/"/g, '""')}"`,
            item.worker_id || "",
            item.device || "",
            item.time,
            item.type,
            item.sync || "synced"
          ];
          csvRows.push(row.join(","));
        });
        csvContent = csvRows.join("\n");
      }

      const formattedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const filename = `${reportName.replace(/\s+/g, '_')}_${dateRange.replace(/\s+/g, '_')}_${formattedDate.replace(/[\s,]+/g, '_')}.csv`;
      downloadCSV(csvContent, filename);

      const newExport: ExportedReport = {
        id: Date.now(),
        name: `${reportName} (${dateRange})`,
        date: formattedDate,
        format: 'CSV',
        status: 'Ready',
        csvContent
      };
      
      const updatedList = [newExport, ...exportsList];
      setExportsList(updatedList);
      localStorage.setItem('recent_exports', JSON.stringify(updatedList));

    } catch (err: unknown) {
      console.error(err);
      const errorObj = err as Error;
      alert('Error generating report: ' + errorObj.message);
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Reloads and downloads a previously generated CSV export from the user session cache.
   */
  const handleDownloadExport = (exp: ExportedReport) => {
    if (exp.csvContent) {
      downloadCSV(exp.csvContent, `${exp.name.replace(/\s+/g, '_')}_${exp.date.replace(/[\s,]+/g, '_')}.csv`);
    } else {
      alert('Report data is expired or not cached.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ marginBottom: 'var(--spacing-xs)' }}>Reports & Analytics</h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>Deep dive into authentication trends and spoof attempts.</p>
        </div>
      </div>

      {/* Toolbar / Filters */}
      <Card style={{ padding: 'var(--spacing-md) var(--spacing-lg)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-md)', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', background: 'var(--color-background)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
            <FileText size={16} color="var(--color-text-secondary)" />
            <select 
              value={reportType} 
              onChange={(e) => setReportType(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.8125rem', color: 'var(--color-text)' }}
            >
              <option value="attendance">Daily Attendance Log</option>
              <option value="spoof">Biometric Spoof Attempts</option>
              <option value="hardware">Hardware Sync Health</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', background: 'var(--color-background)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
            <Calendar size={16} color="var(--color-text-secondary)" />
            <select 
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.8125rem', color: 'var(--color-text)' }}
            >
              <option value="Last 7 Days">Last 7 Days</option>
              <option value="Last 30 Days">Last 30 Days</option>
              <option value="This Quarter">This Quarter</option>
            </select>
          </div>
          
          <div style={{ flex: 1 }} />
          
          <Button 
            icon={isGenerating ? <RefreshCw size={16} className="spin" /> : <Filter size={16} />} 
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating...' : 'Generate New Report'}
          </Button>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--spacing-md)' }}>
        {/* Analytics Chart */}
        <Card style={{ display: 'flex', flexDirection: 'column', padding: 'var(--spacing-lg)' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 'var(--spacing-lg)' }}>Weekly Authentication Volume</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip 
                  cursor={{ fill: 'var(--color-background)' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                <Bar dataKey="success" name="Successful Auth" stackId="a" fill="var(--color-success)" radius={[0, 0, 4, 4]} />
                <Bar dataKey="failed" name="Failed (Timeout/No Face)" stackId="a" fill="var(--color-warning)" />
                <Bar dataKey="spoof" name="Spoof Attempts" stackId="a" fill="var(--color-error)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Recent Exports Table */}
        <Card style={{ display: 'flex', flexDirection: 'column', padding: 'var(--spacing-lg)' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 'var(--spacing-lg)' }}>Recent Exports</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {exportsList.map(exp => (
              <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 'var(--spacing-sm)', borderBottom: '1px solid var(--color-border)' }}>
                <div>
                  <p style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: 2 }}>{exp.name}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{exp.date} • {exp.format}</p>
                </div>
                {exp.status === 'Ready' ? (
                  <button 
                    onClick={() => handleDownloadExport(exp)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-primary)' }}
                  >
                    <Download size={18} />
                  </button>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Expired</span>
                )}
              </div>
            ))}
          </div>
          <Button variant="secondary" style={{ marginTop: 'auto' }} onClick={() => {
            if (confirm('Clear all recent exports?')) {
              setExportsList([]);
              localStorage.removeItem('recent_exports');
            }
          }}>
            Clear Recent Exports
          </Button>
        </Card>
      </div>
      
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

export const Settings: React.FC = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [config, setConfig] = useState({
    s3Bucket: 's3://attendance-system-prod',
    region: 'us-east-1',
    retention: '90',
    confidence: '85',
    emailAlerts: true,
  });

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      alert('System configurations updated successfully.');
    }, 1200);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ marginBottom: 'var(--spacing-xs)' }}>System Settings</h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>Manage global AWS configs, AI thresholds, and admin profiles.</p>
        </div>
        <Button 
          icon={isSaving ? <RefreshCw size={18} className="spin" /> : <Save size={18} />} 
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 'var(--spacing-md)' }}>
        {/* Core Config */}
        <Card style={{ padding: 'var(--spacing-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
            <Database size={20} color="var(--color-primary)" />
            <h3 style={{ fontSize: '1rem' }}>Infrastructure Settings</h3>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <Input 
              label="AWS S3 Bucket Name" 
              value={config.s3Bucket} 
              onChange={(e) => setConfig({...config, s3Bucket: e.target.value})} 
            />
            <Input 
              label="AWS Region" 
              value={config.region} 
              onChange={(e) => setConfig({...config, region: e.target.value})} 
            />
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Data Retention Policy (Days)</label>
              <select 
                value={config.retention}
                onChange={(e) => setConfig({...config, retention: e.target.value})}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text)', fontSize: '0.875rem', outline: 'none' }}
              >
                <option value="30">30 Days</option>
                <option value="90">90 Days</option>
                <option value="180">180 Days</option>
                <option value="365">1 Year</option>
              </select>
            </div>
          </div>
        </Card>

        {/* AI Config */}
        <Card style={{ padding: 'var(--spacing-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
            <Shield size={20} color="var(--color-primary)" />
            <h3 style={{ fontSize: '1rem' }}>AI Biometric Security</h3>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Face Match Confidence Threshold</label>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-primary)' }}>{config.confidence}%</span>
              </div>
              <input 
                type="range" 
                min="50" max="99" 
                value={config.confidence} 
                onChange={(e) => setConfig({...config, confidence: e.target.value})}
                style={{ width: '100%', cursor: 'pointer' }}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                Higher thresholds increase security but may cause more false rejections.
              </p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--spacing-sm)', backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', marginTop: 'var(--spacing-sm)' }}>
              <div>
                <p style={{ fontWeight: 500, fontSize: '0.875rem' }}>Strict Liveness Check</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Require active blinking detection</p>
              </div>
              <input type="checkbox" defaultChecked style={{ width: 18, height: 18, cursor: 'pointer' }} />
            </div>
          </div>
        </Card>
      </div>

      {/* Notifications Row */}
      <Card style={{ padding: 'var(--spacing-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
          <Bell size={20} color="var(--color-primary)" />
          <h3 style={{ fontSize: '1rem' }}>Alerts & Notifications</h3>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          <input 
            type="checkbox" 
            checked={config.emailAlerts}
            onChange={(e) => setConfig({...config, emailAlerts: e.target.checked})}
            style={{ width: 18, height: 18, cursor: 'pointer' }} 
            id="email-alerts"
          />
          <label htmlFor="email-alerts" style={{ cursor: 'pointer' }}>
            <p style={{ fontWeight: 500, fontSize: '0.875rem' }}>Email alerts for Spoof Attempts</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Send immediate notifications to admins when a presentation attack is detected.</p>
          </label>
        </div>
      </Card>
    </div>
  );
};
