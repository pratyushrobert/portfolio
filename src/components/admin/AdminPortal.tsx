import { useEffect, useState } from 'react';
import { useWindowStore } from '../../stores/useWindowStore';
import { logoutAdmin, useAdminAuth } from '../../lib/auth/adminAuth';
import { AdminDashboard } from './AdminDashboard';
import { AdminPortfolioFiles } from './AdminPortfolioFiles';
import { AdminBackground } from './AdminBackground';
import { AdminPortfolioContent } from './AdminPortfolioContent';
import { AdminProjects } from './AdminProjects';
import { AdminCertificates } from './AdminCertificates';
import { AdminSkills } from './AdminSkills';
import { AdminExperience } from './AdminExperience';
import { AdminSiteConfig } from './AdminSiteConfig';
import { AdminSystem } from './AdminSystem';
import {
  LayoutDashboard,
  FolderGit2,
  Cpu,
  Briefcase,
  Award,
  FileArchive,
  Sliders,
  Palette,
  FileText,
  Shield,
  LogOut,
} from 'lucide-react';
import './AdminPortal.css';

interface AdminPortalProps {
  windowId: string;
}

export function AdminPortal({ windowId }: AdminPortalProps) {
  const { closeWindow } = useWindowStore();
  const { status, user, error } = useAdminAuth();
  const [activeSection, setActiveSection] = useState('dashboard');

  useEffect(() => {
    if (status === 'unauthenticated') closeWindow(windowId);
  }, [closeWindow, status, windowId]);

  const handleLogout = async () => {
    try {
      await logoutAdmin();
    } finally {
      closeWindow(windowId);
    }
  };

  if (status === 'loading') {
    return (
      <div className="admin-portal">
        <div className="admin-portal-unauthorized">
          <h2>Checking session...</h2>
        </div>
      </div>
    );
  }

  if (status !== 'authenticated' || !user) {
    return (
      <div className="admin-portal">
        <div className="admin-portal-unauthorized">
          <h2>Not Authenticated</h2>
          <p>{error ?? 'Please log in again.'}</p>
        </div>
      </div>
    );
  }

  const sections = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: FolderGit2 },
    { id: 'skills', label: 'Skills', icon: Cpu },
    { id: 'experience', label: 'Experience', icon: Briefcase },
    { id: 'certificates', label: 'Certificates', icon: Award },
    { id: 'portfolio-files', label: 'Media & Files', icon: FileArchive },
    { id: 'portfolio-content', label: 'Portfolio Bios', icon: FileText },
    { id: 'site-config', label: 'Site Config', icon: Sliders },
    { id: 'background', label: 'Appearance', icon: Palette },
    { id: 'system', label: 'System & Auth', icon: Shield },
  ];

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return <AdminDashboard onNavigate={setActiveSection} />;
      case 'projects':
        return <AdminProjects />;
      case 'skills':
        return <AdminSkills />;
      case 'experience':
        return <AdminExperience />;
      case 'certificates':
        return <AdminCertificates />;
      case 'portfolio-files':
        return <AdminPortfolioFiles />;
      case 'portfolio-content':
        return <AdminPortfolioContent />;
      case 'site-config':
        return <AdminSiteConfig />;
      case 'background':
        return <AdminBackground />;
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
            <span className="admin-portal-subtitle">MimiOS Content Management</span>
          </div>
        </div>
        <div className="admin-portal-user">
          <span>Logged in as: <strong>{user.email}</strong></span>
          <button
            className="admin-btn admin-btn-secondary"
            onClick={() => void handleLogout()}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <LogOut size={13} />
            <span>Logout</span>
          </button>
        </div>
      </div>
      <div className="admin-portal-body">
        <nav className="admin-sidebar">
          <ul>
            {sections.map(section => {
              const IconComponent = section.icon;
              return (
                <li key={section.id}>
                  <button
                    className={`admin-nav-item ${activeSection === section.id ? 'active' : ''}`}
                    onClick={() => setActiveSection(section.id)}
                  >
                    <IconComponent size={16} className="admin-nav-icon" />
                    <span>{section.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <main className="admin-main">{renderSection()}</main>
      </div>
    </div>
  );
}
