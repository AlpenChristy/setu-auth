import React from 'react';
import './ui.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: React.ReactNode;
}

/**
 * Button Component
 * 
 * A standardized button component supporting multiple UI variants
 * (primary, secondary, danger) and optional icons.
 */
export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  icon, 
  className = '', 
  ...props 
}) => {
  return (
    <button 
      className={`btn btn-${variant} ${className}`} 
      {...props}
    >
      {icon && <span className="btn-icon">{icon}</span>}
      {children}
    </button>
  );
};
