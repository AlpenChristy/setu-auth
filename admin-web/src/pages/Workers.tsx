import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusChip } from '../components/ui/StatusChip';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Plus, Search, Filter, Edit2, Trash2 } from 'lucide-react';
import type { Worker } from '../types';
import API_BASE from '../api';

const compressImage = (file: File, callback: (base64: string) => void) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = (event) => {
    const img = new Image();
    img.src = event.target?.result as string;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 200;
      const MAX_HEIGHT = 200;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        callback(dataUrl);
      } else {
        callback(event.target?.result as string);
      }
    };
  };
};

/**
 * Workers Component
 * 
 * Manages the CRUD interface for remote field workers. Handles listing,
 * creating, updating, and deleting profiles, including setting their geofencing
 * coordinates and radius thresholds.
 */
export const Workers: React.FC = () => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  
  // Modal visibility controls
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  // Active selected worker for edit/delete operations
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  
  // Form input states
  const [formData, setFormData] = useState<{
    name: string;
    dept: string;
    password: string;
    assigned_lat: number | string;
    assigned_lng: number | string;
    assigned_radius: number | string;
    face_photo: string;
  }>({
    name: '',
    dept: '',
    password: '',
    assigned_lat: 19.0760,
    assigned_lng: 72.8777,
    assigned_radius: 1000,
    face_photo: ''
  });
  
  // Track open context dropdown menus by worker ID
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  /**
   * Fetches the current list of workers from the local FastAPI backend.
   * Maps backend department/face enrollment fields to frontend states.
   */
  const fetchWorkers = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/workers`);
      if (response.ok) {
        const data = await response.json();
        const mapped: Worker[] = data.map((w: {
          id: string;
          name: string;
          department: string;
          face_enrolled: boolean;
          last_auth: string;
          password?: string;
          assigned_lat: number;
          assigned_lng: number;
          assigned_radius: number;
          face_photo?: string | null;
        }) => ({
          id: w.id,
          name: w.name,
          dept: w.department,
          enrolled: w.face_enrolled,
          lastAuth: w.last_auth,
          password: w.password,
          assigned_lat: w.assigned_lat,
          assigned_lng: w.assigned_lng,
          assigned_radius: w.assigned_radius,
          face_photo: w.face_photo,
          sync: 'success'
        }));
        setWorkers(mapped);
      }
    } catch (error) {
      console.error('Error fetching workers:', error);
    }
  }, []);

  // Retrieve initial worker dataset on component mount
  useEffect(() => {
    const init = async () => {
      await fetchWorkers();
    };
    init();
  }, [fetchWorkers]);

  /**
   * Opens the registration modal, pre-populating with details if editing.
   */
  const handleOpenModal = (worker: Worker | null = null) => {
    if (worker) {
      setEditingWorker(worker);
      setFormData({
        name: worker.name,
        dept: worker.dept,
        password: worker.password || '123456',
        assigned_lat: worker.assigned_lat ?? 19.0760,
        assigned_lng: worker.assigned_lng ?? 72.8777,
        assigned_radius: worker.assigned_radius ?? 1000,
        face_photo: worker.face_photo || ''
      });
    } else {
      setEditingWorker(null);
      setFormData({
        name: '',
        dept: '',
        password: '123456',
        assigned_lat: 19.0760,
        assigned_lng: 72.8777,
        assigned_radius: 1000,
        face_photo: ''
      });
    }
    setIsModalOpen(true);
    setActiveDropdown(null);
  };

  /**
   * Pre-selects a worker and shows the deletion confirmation warning.
   */
  const handleOpenDelete = (worker: Worker) => {
    setEditingWorker(worker);
    setIsDeleteModalOpen(true);
    setActiveDropdown(null);
  };

  /**
   * Handles creating a new worker profile or updating an existing one.
   * Parses text input coordinates into floating-point numbers.
   */
  const handleSave = async () => {
    if (!formData.name) return;
    
    // Parse coordinates safely, defaulting to zero if input is invalid
    const latVal = typeof formData.assigned_lat === 'number' ? formData.assigned_lat : parseFloat(formData.assigned_lat) || 0.0;
    const lngVal = typeof formData.assigned_lng === 'number' ? formData.assigned_lng : parseFloat(formData.assigned_lng) || 0.0;
    const radiusVal = typeof formData.assigned_radius === 'number' ? formData.assigned_radius : parseFloat(formData.assigned_radius) || 1000.0;

    try {
      if (editingWorker) {
        const response = await fetch(`${API_BASE}/api/workers/${editingWorker.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.name,
            department: formData.dept,
            device_id: 'None',
            password: formData.password,
            assigned_lat: latVal,
            assigned_lng: lngVal,
            assigned_radius: radiusVal,
            face_photo: formData.face_photo || null
          }),
        });
        if (response.ok) {
          fetchWorkers();
        }
      } else {
        const response = await fetch(`${API_BASE}/api/workers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.name,
            department: formData.dept || 'Unassigned',
            device_id: 'None',
            password: formData.password || '123456',
            assigned_lat: latVal,
            assigned_lng: lngVal,
            assigned_radius: radiusVal,
            face_photo: formData.face_photo || null
          }),
        });
        if (response.ok) {
          fetchWorkers();
        }
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving worker:', error);
    }
  };

  /**
   * Deletes the selected worker and triggers a remote cache/embedding revocation.
   */
  const handleDelete = async () => {
    if (!editingWorker) return;
    try {
      const response = await fetch(`${API_BASE}/api/workers/${editingWorker.id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchWorkers();
      }
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting worker:', error);
    }
  };



  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }} onClick={() => activeDropdown && setActiveDropdown(null)}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ marginBottom: 'var(--spacing-xs)' }}>Worker Management</h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>Manage field workers, enrollments, and device assignments.</p>
        </div>
        <Button icon={<Plus size={18} />} onClick={() => handleOpenModal()}>Add Worker</Button>
      </div>

      {/* Toolbar */}
      <Card style={{ padding: 'var(--spacing-sm) var(--spacing-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', background: 'var(--color-background)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', width: '300px', border: '1px solid var(--color-border)' }}>
              <Search size={16} color="var(--color-text-secondary)" />
              <input type="text" placeholder="Search by name or ID..." style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.8125rem' }} />
            </div>
            <Button variant="secondary" icon={<Filter size={16} />}>Filter</Button>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>Showing {workers.length} workers</p>
        </div>
      </Card>

      {/* Table */}
      <Card style={{ padding: 0, overflow: 'visible' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--color-background)', borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ padding: 'var(--spacing-md) var(--spacing-lg)', fontWeight: 600, fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>Worker</th>
              <th style={{ padding: 'var(--spacing-md) var(--spacing-lg)', fontWeight: 600, fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>Department</th>
              <th style={{ padding: 'var(--spacing-md) var(--spacing-lg)', fontWeight: 600, fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>Face Status</th>
              <th style={{ padding: 'var(--spacing-md) var(--spacing-lg)', fontWeight: 600, fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>Last Auth</th>
              <th style={{ padding: 'var(--spacing-md) var(--spacing-lg)', fontWeight: 600, fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((worker) => (
              <tr key={worker.id} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background-color 0.2s' }}>
                <td style={{ padding: 'var(--spacing-md) var(--spacing-lg)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                  {worker.face_photo ? (
                    <img 
                      src={worker.face_photo} 
                      alt={worker.name} 
                      style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} 
                    />
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 600 }}>
                      {worker.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p style={{ fontWeight: 500, color: 'var(--color-text)' }}>{worker.name}</p>
                    <p style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)' }}>{worker.id}</p>
                  </div>
                </td>
                <td style={{ padding: 'var(--spacing-md) var(--spacing-lg)', fontSize: '0.8125rem' }}>{worker.dept}</td>
                <td style={{ padding: 'var(--spacing-md) var(--spacing-lg)' }}>
                  <StatusChip 
                    status={worker.enrolled ? 'success' : 'warning'} 
                    label={worker.enrolled ? 'Enrolled' : 'Pending'} 
                  />
                </td>
                <td style={{ padding: 'var(--spacing-md) var(--spacing-lg)', fontSize: '0.8125rem' }}>{worker.lastAuth}</td>
                <td style={{ padding: 'var(--spacing-md) var(--spacing-lg)' }}>
                  <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center' }}>
                    <button onClick={() => handleOpenModal(worker)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'flex' }}><Edit2 size={16} /></button>
                    <button onClick={() => handleOpenDelete(worker)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-error)', display: 'flex' }}><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Add/Edit Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingWorker ? 'Edit Worker' : 'Add New Worker'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', maxHeight: '70vh', overflowY: 'auto', paddingRight: '4px' }}>
          <Input 
            label="Full Name" 
            value={formData.name} 
            onChange={(e) => setFormData({...formData, name: e.target.value})} 
            placeholder="e.g. John Doe"
          />
          <Input 
            label="Department" 
            value={formData.dept} 
            onChange={(e) => setFormData({...formData, dept: e.target.value})} 
            placeholder="e.g. Operations"
          />
          <Input 
            label="Password" 
            type="password"
            value={formData.password} 
            onChange={(e) => setFormData({...formData, password: e.target.value})} 
            placeholder="e.g. 123456"
          />
          <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
            <div style={{ flex: 1 }}>
              <Input 
                label="Assigned Lat" 
                value={formData.assigned_lat} 
                onChange={(e) => setFormData({...formData, assigned_lat: e.target.value})} 
                placeholder="e.g. 19.0760"
              />
            </div>
            <div style={{ flex: 1 }}>
              <Input 
                label="Assigned Lng" 
                value={formData.assigned_lng} 
                onChange={(e) => setFormData({...formData, assigned_lng: e.target.value})} 
                placeholder="e.g. 72.8777"
              />
            </div>
          </div>
          <Input 
            label="Assigned Radius (meters)" 
            value={formData.assigned_radius} 
            onChange={(e) => setFormData({...formData, assigned_radius: e.target.value})} 
            placeholder="e.g. 1000"
          />
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Profile Photo</label>
            <input 
              type="file" 
              accept="image/*" 
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  compressImage(file, (base64) => {
                    setFormData({ ...formData, face_photo: base64 });
                  });
                }
              }} 
            />
            {formData.face_photo && (
              <img 
                src={formData.face_photo} 
                alt="Profile Preview" 
                style={{ width: 64, height: 64, borderRadius: 32, marginTop: 8, objectFit: 'cover' }} 
              />
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-md)' }}>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Worker</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)} 
        title="Delete Worker"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            Are you sure you want to delete <strong>{editingWorker?.name}</strong>? This action cannot be undone and will revoke their face embeddings from all assigned devices.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-md)' }}>
            <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Yes, Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
