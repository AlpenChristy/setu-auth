import React from 'react';
import './ui.css';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

/**
 * Card Component
 * 
 * Standard container component with border styling, padding, and
 * optional interactive hover states for layouts.
 */
export const Card: React.FC<CardProps> = ({ 
  children, 
  hoverable = false, 
  className = '', 
  ...props 
}) => {
  return (
    <div 
      className={`card ${hoverable ? 'card-hoverable' : ''} ${className}`} 
      {...props}
    >
      {children}
    </div>
  );
};
