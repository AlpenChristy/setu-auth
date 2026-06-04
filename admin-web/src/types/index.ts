/**
 * Shared Type Definitions for SetuAuth Admin Dashboard
 * 
 * Defines standard interfaces for core entities including Workers,
 * Logs, Attendance, and Analytics stats.
 */

export interface Worker {
  id: string;
  name: string;
  dept: string;
  enrolled: boolean;
  lastAuth: string;
  password?: string;
  assigned_lat: number;
  assigned_lng: number;
  assigned_radius: number;
  face_photo?: string | null;
  sync?: 'success' | 'pending' | 'failed';
}

export interface LogDetails {
  confidence: string;
  duration?: string;
  error?: string;
  lat: number;
  lng: number;
}

export interface Log {
  id: string;
  time: string;
  worker: string;
  worker_id?: string;
  type: string;
  device: string;
  status: 'Success' | 'Failed' | 'Spoof Attempt';
  sync?: 'synced' | 'pending' | 'failed';
  details: LogDetails;
}

export interface AttendanceRecord {
  id: string;
  worker_id: string;
  worker_name?: string;
  department?: string;
  date: string;
  check_in?: string;
  check_out?: string;
  check_in_location?: string | null;
  check_out_location?: string | null;
  status: 'present' | 'absent' | 'late';
  working_hours?: number;
  created_at: string;
}

export interface ChartDataPoint {
  name: string;
  success: number;
  failed: number;
  spoof?: number;
}

export interface DashboardStats {
  total_workers: number;
  authentications_today: number;
  pending_sync: number;
  spoof_attempts_today: number;
  chart_data?: ChartDataPoint[];
}

export interface ExportedReport {
  id: number;
  name: string;
  date: string;
  format: string;
  status: string;
  csvContent?: string;
}
