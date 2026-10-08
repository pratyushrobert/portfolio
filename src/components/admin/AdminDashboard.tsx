import { useEffect, useState } from 'react';
import { adminApi, type AdminDashboardData } from '../../lib/api/admin';
import { getApiErrorMessage } from '../../lib/api/client';
import {
  FolderGit2,
  Cpu,
  Briefcase,
  Award,
  FileArchive,
  Users,
  GitBranch,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Shield,
  Database,
  Sliders,
  Palette,
  RefreshCw,
} from 'lucide-react';
import './AdminDashboard.css';
import './AdminPortal.css';

interface AdminDashboardProps {
  onNavigate?: (section: string) => void;
}

export function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.dashboard();
      setData(res);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDashboard();
  }, []);

  return (
    <div className="admin-section" style={{ maxWidth: 900 }}>
      <div className="admin-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2>System Dashboard</h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Authoritative overview of portfolio content, assets, and GitHub synchronization
          </span>
        </div>
        <button
          className="admin-btn admin-btn-secondary"
          onClick={() => void fetchDashboard()}
          disabled={loading}
          title="Refresh dashboard statistics"
        >
          <RefreshCw size={14} className={loading ? 'spinning' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(231, 76, 60, 0.15)', border: '1px solid rgba(231, 76, 60, 0.3)', borderRadius: 6, color: '#e74c3c', marginBottom: 16 }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 32, color: 'var(--text-muted)' }}>
          <Loader2 className="spinning" size={20} />
          <span>Loading backend statistics...</span>
        </div>
      ) : (
        <>
          {/* Main Statistics Grid */}
          <div className="admin-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
            <div className="admin-stat-card" onClick={() => onNavigate?.('projects')} style={{ cursor: 'pointer' }}>
              <div className="admin-stat-icon"><FolderGit2 size={24} style={{ color: 'var(--accent)' }} /></div>
              <div className="admin-stat-value">{data?.projects ?? 0}</div>
              <div className="admin-stat-label">Projects ({data?.projects_public ?? 0} Public)</div>
            </div>

            <div className="admin-stat-card" onClick={() => onNavigate?.('skills')} style={{ cursor: 'pointer' }}>
              <div className="admin-stat-icon"><Cpu size={24} style={{ color: '#00d2d3' }} /></div>
              <div className="admin-stat-value">{data?.skills ?? 0}</div>
              <div className="admin-stat-label">Skills ({data?.skills_public ?? 0} Public)</div>
            </div>

            <div className="admin-stat-card" onClick={() => onNavigate?.('experience')} style={{ cursor: 'pointer' }}>
              <div className="admin-stat-icon"><Briefcase size={24} style={{ color: '#54a0ff' }} /></div>
              <div className="admin-stat-value">{data?.experience ?? 0}</div>
              <div className="admin-stat-label">Experience Positions</div>
            </div>

            <div className="admin-stat-card" onClick={() => onNavigate?.('certificates')} style={{ cursor: 'pointer' }}>
              <div className="admin-stat-icon"><Award size={24} style={{ color: '#feca57' }} /></div>
              <div className="admin-stat-value">{data?.certificates ?? 0}</div>
              <div className="admin-stat-label">Certificates</div>
            </div>

            <div className="admin-stat-card" onClick={() => onNavigate?.('portfolio-files')} style={{ cursor: 'pointer' }}>
              <div className="admin-stat-icon"><FileArchive size={24} style={{ color: '#ff9ff3' }} /></div>
              <div className="admin-stat-value">{data?.assets ?? 0}</div>
              <div className="admin-stat-label">Uploaded Assets</div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-icon"><Users size={24} style={{ color: '#1dd1a1' }} /></div>
              <div className="admin-stat-value">{data?.active_sessions ?? 0}</div>
              <div className="admin-stat-label">Active Admin Sessions</div>
            </div>
          </div>

          {/* GitHub Sync Status Card */}
          <div className="admin-card" style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <GitBranch size={18} style={{ color: 'var(--accent)' }} />
                <h3 style={{ margin: 0, fontSize: 15 }}>GitHub Integration & Discovery</h3>
              </div>
              <span className="admin-badge public" style={{ fontSize: 11 }}>
                Account: {data?.github_username || 'pratyushrobert'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 8 }}>
              <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Linked to Repositories</div>
                <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2, color: 'var(--text-h)' }}>
                  {data?.github_linked_projects ?? 0} Projects
                </div>
              </div>

              <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Metadata Synced</div>
                <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2, color: '#2ecc71', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={16} />
                  <span>{data?.github_synced_projects ?? 0} Synced</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="admin-btn admin-btn-secondary"
                onClick={() => onNavigate?.('projects')}
                style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span>View Discovered Repositories in Projects</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>

          {/* Quick Management Shortcuts */}
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 14, marginBottom: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Quick Management Shortcuts
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
              <button
                className="admin-btn admin-btn-secondary"
                onClick={() => onNavigate?.('projects')}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', justifyContent: 'flex-start' }}
              >
                <FolderGit2 size={15} style={{ color: 'var(--accent)' }} />
                <span>Projects</span>
              </button>

              <button
                className="admin-btn admin-btn-secondary"
                onClick={() => onNavigate?.('skills')}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', justifyContent: 'flex-start' }}
              >
                <Cpu size={15} style={{ color: '#00d2d3' }} />
                <span>Skills</span>
              </button>

              <button
                className="admin-btn admin-btn-secondary"
                onClick={() => onNavigate?.('experience')}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', justifyContent: 'flex-start' }}
              >
                <Briefcase size={15} style={{ color: '#54a0ff' }} />
                <span>Experience</span>
              </button>

              <button
                className="admin-btn admin-btn-secondary"
                onClick={() => onNavigate?.('certificates')}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', justifyContent: 'flex-start' }}
              >
                <Award size={15} style={{ color: '#feca57' }} />
                <span>Certificates</span>
              </button>

              <button
                className="admin-btn admin-btn-secondary"
                onClick={() => onNavigate?.('portfolio-files')}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', justifyContent: 'flex-start' }}
              >
                <FileArchive size={15} style={{ color: '#ff9ff3' }} />
                <span>Media Assets</span>
              </button>

              <button
                className="admin-btn admin-btn-secondary"
                onClick={() => onNavigate?.('site-config')}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', justifyContent: 'flex-start' }}
              >
                <Sliders size={15} style={{ color: '#1dd1a1' }} />
                <span>Site Config</span>
              </button>

              <button
                className="admin-btn admin-btn-secondary"
                onClick={() => onNavigate?.('background')}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', justifyContent: 'flex-start' }}
              >
                <Palette size={15} style={{ color: '#f368e0' }} />
                <span>Appearance</span>
              </button>
            </div>
          </div>

          {/* Architecture Card */}
          <div className="admin-card-grid" style={{ marginTop: 24 }}>
            <div className="admin-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Shield size={16} style={{ color: '#2ecc71' }} />
                <h3 style={{ margin: 0 }}>Authentication & Security</h3>
              </div>
              <p className="status-ok">Signed HttpOnly Session Active</p>
              <div className="admin-card-meta">CSRF Protected • Bcrypt Password Hash</div>
            </div>

            <div className="admin-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Database size={16} style={{ color: 'var(--accent)' }} />
                <h3 style={{ margin: 0 }}>Database Storage</h3>
              </div>
              <p className="status-ok">Fastify 5 + PostgreSQL Backend</p>
              <div className="admin-card-meta">Database: Supabase PostgreSQL (Managed Pool)</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}