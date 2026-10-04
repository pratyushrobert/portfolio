import { useState, useEffect } from 'react';
import { useWindowStore } from '../../stores/useWindowStore';
import { isAdminAuthenticated, clearAdminAuth } from '../../lib/auth/adminAuth';
import { AdminDashboard } from './AdminDashboard';
import { AdminPortfolioFiles } from './AdminPortfolioFiles';
import { AdminBackground } from './AdminBackground';
import { AdminPortfolioContent } from './AdminPortfolioContent';
import { AdminProjects } from './AdminProjects';
import { AdminCertificates } from './AdminCertificates';
import { AdminSkills } from './AdminSkills';
import { AdminExperience } from './AdminExperience';
import { AdminSystem } from './AdminSystem';
import './AdminPortal.css';

interface AdminPortalProps {
  windowId: string;
}

export function AdminPortal({ windowId }: AdminPortalProps) {
  const { closeWindow } = useWindowStore();
  const [activeSection, setActiveSection] = useState<string>('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check auth on mount
  useEffect(() => {
    const authed = isAdminAuthenticated();
    setIsAuthenticated(authed);
    if (!authed) {
      closeWindow(windowId);
    }
  }, [windowId, closeWindow]);

  const handleLogout = () => {
    clearAdminAuth();
    closeWindow(windowId);
  };

  if (!isAuthenticated) {
    return (
      <div className="admin-portal">
        <div className="admin-portal-unauthorized">
          <h2>Not Authenticated</h2>
          <p>Please log in via the MIMI-SERVANT command.</p>
        </div>
      </div>
    );
  }

  const sections = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'portfolio-files', label: 'Portfolio Files', icon: '📁' },
    { id: 'background', label: 'Background', icon: '🖼️' },
    { id: 'portfolio-content', label: 'Portfolio Content', icon: '📝' },
    { id: 'projects', label: 'Projects', icon: '🚀' },
    { id: 'certificates', label: 'Certificates', icon: '📜' },
    { id: 'skills', label: 'Skills', icon: '🛠️' },
    { id: 'experience', label: 'Experience', icon: '💼' },
    { id: 'system', label: 'System', icon: '⚙️' },
  ];

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return <AdminDashboard />;
      case 'portfolio-files':
        return <AdminPortfolioFiles />;
      case 'background':
        return <AdminBackground />;
      case 'portfolio-content':
        return <AdminPortfolioContent />;
      case 'projects':
        return <AdminProjects />;
      case 'certificates':
        return <AdminCertificates />;
      case 'skills':
        return <AdminSkills />;
      case 'experience':
        return <AdminExperience />;
      case 'system':
        return <AdminSystem windowId={windowId} />;
      default:
        return <div>Select a section</div>;
    }
  };

  return (
    <div className="admin-portal">
      <div className="admin-portal-header">
        <div className="admin-portal-title">
          <span className="admin-portal-icon">🐱</span>
          <div>
            <h1>Admin Portal</h1>
            <span className="admin-portal-subtitle">MimiOS Configuration</span>
          </div>
        </div>
        <div className="admin-portal-user">
          <span>Logged in as: admin</span>
          <button className="admin-btn admin-btn-secondary" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className="admin-portal-body">
        <nav className="admin-sidebar">
          <ul>
            {sections.map(section => (
              <li key={section.id}>
                <button
                  className={`admin-nav-item ${activeSection === section.id ? 'active' : ''}`}
                  onClick={() => setActiveSection(section.id)}
                >
                  <span className="admin-nav-icon">{section.icon}</span>
                  <span>{section.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <main className="admin-main">
          {renderSection()}
        </main>
      </div>
    </div>
  );
}