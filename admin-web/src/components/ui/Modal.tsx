import React from 'react';
import { X } from 'lucide-react';
import './ui.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/**
 * Modal Component
 * 
 * Overlay dialog container supporting state-controlled visibility, close buttons,
 * and customizable title headers.
 */
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button onClick={onClose} className="modal-close"><X size={20} /></button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
};
