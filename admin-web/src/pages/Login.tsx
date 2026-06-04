import React, { useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Lock, Mail } from 'lucide-react';
import logoImg from '../assets/logo.png';
import { useNavigate } from 'react-router-dom';
import API_BASE from '../api';

interface LoginProps {
  onLogin: () => void;
}

/**
 * Login Component
 * 
 * Secure portal for administrative session setup. Handles POST queries to
 * the /api/admin/login backend, caching credentials inside localStorage on success.
 */
export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          onLogin();
          navigate('/dashboard');
        } else {
          alert(data.message || 'Login failed. Please check your credentials.');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.detail || 'Invalid email or password.');
      }
    } catch (err) {
      console.error('Error logging in:', err);
      alert('Failed to connect to backend server. Please make sure the backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh', 
      width: '100vw',
      backgroundColor: 'var(--color-background)',
      backgroundImage: 'radial-gradient(circle at top right, rgba(37, 99, 235, 0.05), transparent 400px), radial-gradient(circle at bottom left, rgba(37, 99, 235, 0.05), transparent 400px)'
    }}>
      <Card style={{ width: 400, padding: 'var(--spacing-xxl)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <img 
          src={logoImg} 
          alt="SetuAuth Logo" 
          style={{ 
            width: 64, 
            height: 64, 
            objectFit: 'contain',
            marginBottom: 'var(--spacing-lg)'
          }} 
        />
        
        <h1 style={{ fontSize: '1.5rem', marginBottom: 'var(--spacing-xs)' }}>SetuAuth</h1>
        <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', marginBottom: 'var(--spacing-xl)', fontSize: '0.875rem' }}>
          Sign in to manage field attendance and device security.
        </p>

        <form onSubmit={handleLogin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: 38, left: 12, color: 'var(--color-text-tertiary)' }}>
              <Mail size={16} />
            </div>
            <Input 
              label="Email Address"
              type="email"
              placeholder="abc@gmail.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>
          
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: 38, left: 12, color: 'var(--color-text-tertiary)' }}>
              <Lock size={16} />
            </div>
            <Input 
              label="Password"
              type="password"
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-8px' }}>
            <a href="#" style={{ fontSize: '0.75rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>Forgot password?</a>
          </div>

          <Button type="submit" disabled={isLoading} style={{ marginTop: 'var(--spacing-sm)', padding: '12px' }}>
            {isLoading ? 'Authenticating...' : 'Sign In'}
          </Button>
        </form>
      </Card>
    </div>
  );
};
