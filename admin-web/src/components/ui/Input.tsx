import React from 'react';
import './ui.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

/**
 * Input Component
 * 
 * Standard text input field supporting dynamic form labels and
 * auto-generated html 'id' matching rules.
 */
export const Input: React.FC<InputProps> = ({ label, id, className = '', ...props }) => {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  
  return (
    <div className={`input-wrapper ${className}`}>
      {label && <label htmlFor={inputId} className="input-label">{label}</label>}
      <input 
        id={inputId}
        className="input-field" 
        {...props} 
      />
    </div>
  );
};
