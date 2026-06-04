import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { ArrowRight } from 'lucide-react';
import logoImg from '../assets/logo.png';
import landingImg from '../assets/landingpage.png';
import './LandingPage.css';

/**
 * LandingPage Component
 * 
 * Renders the simplified informational landing page for SetuAuth,
 * containing a single hero section describing the system's purpose.
 */
export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-container" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* 1. NAVBAR */}
      <nav className="landing-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '1.25rem' }}>
          <img src={logoImg} alt="Logo" style={{ width: 28, height: 28, objectFit: 'contain' }} />
          <span>SetuAuth</span>
        </div>
        <div className="nav-links">
          <Button onClick={() => navigate('/login')}>Sign In</Button>
        </div>
      </nav>

      {/* 2. HERO / MAIN CONTENT SECTION */}
      <section className="hero-wrapper" style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <div className="hero-grid animate-fade-in" style={{ width: '100%' }}>
          <div>
            <h1 className="hero-title">Secure Offline Workforce Authentication</h1>
            <p className="hero-subtitle" style={{ fontSize: '1.05rem', lineHeight: '1.6', color: 'var(--color-text-secondary)', marginBottom: '28px', maxWidth: '520px' }}>
              SetuAuth is an AI-powered facial recognition and liveness verification system built specifically for remote and zero-network field operations. By combining edge AI processing with secure local storage, SetuAuth enables 100% offline identity verification that automatically syncs with the AWS cloud once internet connectivity is restored.
            </p>
            <div style={{ display: 'flex', gap: '16px' }}>
              <Button onClick={() => navigate('/login')} style={{ padding: '12px 24px', fontSize: '1rem' }}>
                Access Dashboard <ArrowRight size={18} style={{ marginLeft: '8px' }} />
              </Button>
            </div>
          </div>
          
          <div className="hero-mockup-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <img 
              src={landingImg} 
              alt="SetuAuth Dashboard Mockup" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '380px', 
                objectFit: 'contain'
              }} 
            />
          </div>
        </div>
      </section>
    </div>
  );
};
