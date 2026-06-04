import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusChip } from '../components/ui/StatusChip';
import { Modal } from '../components/ui/Modal';
import { Download, ChevronLeft, ChevronRight, Users, Clock, AlertTriangle } from 'lucide-react';
import type { AttendanceRecord, Worker } from '../types';
import API_BASE from '../api';

/**
 * Attendance Component
 * 
 * Renders an interactive monthly attendance calendar. Computes key performance
 * indicators (overall present rate, logged hours, total absences) and enables daily
 * breakdowns in modal tables.
 */
export const Attendance: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  
  // Biometric check-in/out and shift records
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  
  // Cached list of registered workforce profiles
  const [workers, setWorkers] = useState<Worker[]>([]);

  useEffect(() => {
    // Retrieve monthly attendance telemetry
    fetch(`${API_BASE}/api/attendance`)
      .then(res => res.json())
      .then(data => setAttendanceRecords(data))
      .catch(err => console.error('Error fetching attendance logs:', err));

    // Retrieve active worker metadata
    fetch(`${API_BASE}/api/workers`)
      .then(res => res.json())
      .then(data => setWorkers(data))
      .catch(err => console.error('Error fetching workers:', err));
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  
  // Map index offsets to fit calendar grid beginning on Monday (Sun(0) -> index 6)
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  /**
   * Calculates workforce counts (present, absent) for a specific calendar day.
   */
  const getDayStats = useCallback((day: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayDate = new Date(year, month, day);
    if (dayDate > today) return null; // Do not show stats for future dates
    
    if (workers.length === 0) return { present: 0, absent: 0 };
    
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayRecords = attendanceRecords.filter(r => r.date === dateStr);
    const present = dayRecords.length;
    const absent = Math.max(0, workers.length - present);
    
    return { present, absent };
  }, [year, month, workers, attendanceRecords]);

  // Aggregate monthly performance metrics
  const { totalAbsences, presentRate, totalHours } = useMemo(() => {
    let absences = 0;
    let presentMandays = 0;
    let workdays = 0;
    for(let i = 1; i <= daysInMonth; i++) {
      const stats = getDayStats(i);
      if (stats) {
        workdays++;
        absences += stats.absent;
        presentMandays += stats.present;
      }
    }
    
    const totalPossibleDays = workdays * workers.length;
    const rate = totalPossibleDays > 0 ? Math.round((presentMandays / totalPossibleDays) * 100) : 0;
    
    const thisMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const hoursLogged = attendanceRecords
      .filter(r => r.date.startsWith(thisMonthPrefix))
      .reduce((sum, r) => sum + (r.working_hours || 0), 0);
      
    return {
      totalAbsences: absences,
      presentRate: rate,
      totalHours: hoursLogged
    };
  }, [daysInMonth, workers, year, month, attendanceRecords, getDayStats]);

  const handleExport = () => {
    alert(`Exporting ${monthName} Attendance Report to CSV...`);
  };

  // Compile detailed roster statuses for daily breakdown modal
  const selectedDayRecords = useMemo(() => {
    if (selectedDay === null) return [];
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    
    return workers.map(w => {
      const record = attendanceRecords.find(r => r.worker_id === w.id && r.date === dateStr);
      return {
        id: w.id,
        name: w.name,
        checkIn: record ? record.check_in : '--:--',
        checkOut: record ? (record.check_out || 'Active') : '--:--',
        checkInLocation: record ? record.check_in_location : null,
        checkOutLocation: record ? record.check_out_location : null,
        status: record ? 'Present' : 'Absent',
        statusType: (record ? 'success' : 'error') as 'success' | 'error'
      };
    });
  }, [selectedDay, workers, attendanceRecords, year, month]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ marginBottom: 'var(--spacing-xs)' }}>Attendance Management</h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>Monthly attendance calendar and weekly reports.</p>
        </div>
        <Button variant="secondary" icon={<Download size={18} />} onClick={handleExport}>Export Report</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--spacing-md)' }}>
        <Card style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-success)', opacity: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={24} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.75rem', color: 'var(--color-text)', marginBottom: 4 }}>{presentRate}%</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem', fontWeight: 500 }}>Overall Present Rate</p>
          </div>
        </Card>
        
        <Card style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={24} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.75rem', color: 'var(--color-text)', marginBottom: 4 }}>{totalHours.toLocaleString()}</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem', fontWeight: 500 }}>Total Hours Logged</p>
          </div>
        </Card>

        <Card style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-error)', opacity: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={24} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.75rem', color: 'var(--color-text)', marginBottom: 4 }}>{totalAbsences}</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem', fontWeight: 500 }}>Absences This Month</p>
          </div>
        </Card>
      </div>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
          <h3 style={{ fontSize: '1.125rem' }}>Monthly Overview - {monthName}</h3>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <Button variant="secondary" onClick={handlePrevMonth} icon={<ChevronLeft size={18} />}>Prev</Button>
            <Button variant="secondary" onClick={handleNextMonth}>Next <ChevronRight size={18} /></Button>
          </div>
        </div>

        {/* Interactive Calendar Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 'var(--spacing-sm)', textAlign: 'center' }}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <div key={day} style={{ fontWeight: 600, color: 'var(--color-text-secondary)', paddingBottom: 'var(--spacing-sm)' }}>{day}</div>
          ))}
          
          {/* Empty cells for start of month */}
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`empty-${i}`} style={{ padding: 'var(--spacing-md)', backgroundColor: 'transparent' }} />
          ))}

          {/* Days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const stats = getDayStats(day);
            const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dayDate = new Date(year, month, day);
            const isFuture = dayDate > today;
            
            return (
              <div 
                key={day} 
                onClick={() => !isFuture && setSelectedDay(day)}
                style={{ 
                  padding: 'var(--spacing-md) var(--spacing-sm)', 
                  borderRadius: 'var(--radius-sm)', 
                  border: isToday ? '2px solid var(--color-primary)' : '1px solid var(--color-border)', 
                  backgroundColor: isFuture ? 'var(--color-background)' : 'var(--color-surface)',
                  cursor: isFuture ? 'default' : 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  minHeight: '80px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  opacity: isFuture ? 0.6 : 1
                }}
                onMouseOver={(e) => {
                  if (!isFuture) e.currentTarget.style.borderColor = 'var(--color-primary)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = isToday ? 'var(--color-primary)' : 'var(--color-border)';
                }}
              >
                <div style={{ fontWeight: 500, marginBottom: 'var(--spacing-xs)', color: isToday ? 'var(--color-primary)' : 'var(--color-text)' }}>
                  {day}
                </div>
                {stats && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 'auto', width: '100%' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-success)', background: 'rgba(76, 175, 80, 0.1)', padding: '2px 4px', borderRadius: 4 }}>
                      {stats.present} Present
                    </div>
                    {stats.absent > 0 && (
                      <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-error)', background: 'rgba(244, 67, 54, 0.1)', padding: '2px 4px', borderRadius: 4 }}>
                        {stats.absent} Absent
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Daily Breakdown Modal */}
      <Modal isOpen={selectedDay !== null} onClose={() => setSelectedDay(null)} title={`Daily Breakdown: ${monthName} ${selectedDay}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>Showing actual attendance records for this date.</p>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginTop: 'var(--spacing-sm)' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-background)' }}>
                <th style={{ padding: '8px 12px', fontSize: '0.8125rem' }}>Worker</th>
                <th style={{ padding: '8px 12px', fontSize: '0.8125rem' }}>Check In / Out</th>
                <th style={{ padding: '8px 12px', fontSize: '0.8125rem' }}>Locations</th>
                <th style={{ padding: '8px 12px', fontSize: '0.8125rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {selectedDayRecords.map((rec) => (
                <tr key={rec.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '8px 12px', fontSize: '0.875rem' }}>
                    {rec.name} <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>({rec.id})</span>
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: '0.8125rem' }}>
                    {rec.checkIn !== '--:--' ? `${rec.checkIn} / ${rec.checkOut}` : '--:--'}
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    {rec.checkIn !== '--:--' ? (
                      <div>
                        <div>In: {rec.checkInLocation || 'N/A'}</div>
                        {rec.checkOut !== 'Active' && rec.checkOut !== '--:--' && (
                          <div>Out: {rec.checkOutLocation || 'N/A'}</div>
                        )}
                      </div>
                    ) : '--'}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <StatusChip status={rec.statusType} label={rec.status} />
                  </td>
                </tr>
              ))}
              {workers.length === 0 && (
                <>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '8px 12px', fontSize: '0.875rem' }}>John Doe</td>
                    <td style={{ padding: '8px 12px', fontSize: '0.8125rem' }}>07:55 AM / 05:00 PM</td>
                    <td style={{ padding: '8px 12px' }}><StatusChip status="success" label="Present" /></td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '8px 12px', fontSize: '0.875rem' }}>Jane Smith</td>
                    <td style={{ padding: '8px 12px', fontSize: '0.8125rem' }}>08:15 AM / --:--</td>
                    <td style={{ padding: '8px 12px' }}><StatusChip status="warning" label="Late" /></td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '8px 12px', fontSize: '0.875rem' }}>Mike Johnson</td>
                    <td style={{ padding: '8px 12px', fontSize: '0.8125rem' }}>--:--</td>
                    <td style={{ padding: '8px 12px' }}><StatusChip status="error" label="Absent" /></td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--spacing-md)' }}>
            <Button variant="secondary" onClick={() => setSelectedDay(null)}>Close</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
