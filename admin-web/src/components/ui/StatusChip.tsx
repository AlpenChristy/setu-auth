import React from 'react';
import './ui.css';

interface StatusChipProps {
  status: 'success' | 'warning' | 'error' | 'neutral';
  label: string;
  icon?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * StatusChip Component
 * 
 * Styled badge indicators supporting four state contexts (success, warning, error, neutral)
 * and optional prefix icon nodes.
 */
export const StatusChip: React.FC<StatusChipProps> = ({ status, label, icon, className = '', style }) => {
  return (
    <span className={`status-chip status-${status} ${className}`} style={style}>
      {icon && <span className="chip-icon">{icon}</span>}
      {label}
    </span>
  );
};
