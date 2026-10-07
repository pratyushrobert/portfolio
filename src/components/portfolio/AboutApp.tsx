import { useState, useEffect, useCallback } from 'react';
import { portfolioApi } from '../../lib/api/portfolio';
import { configApi } from '../../lib/api/config';
import { getApiErrorMessage } from '../../lib/api/client';
import {
  User,
  FileText,
  Mail,
  FolderGit2,
  Cpu,
  ExternalLink,
  RefreshCw,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { renderMarkdownSafe, isValidUrl } from '../../lib/portfolioUtils';
import type { DesktopOpenRequest } from '../../types/desktop';
import './Portfolio.css';

interface AboutAppProps {
  windowId: string;
  onOpenRequest?: (request: DesktopOpenRequest) => void;
}

export function AboutApp({ windowId: _windowId, onOpenRequest }: AboutAppProps) {
  const [aboutContent, setAboutContent] = useState<string>('');
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [portfolioMap, siteConfig] = await Promise.all([
        portfolioApi.get().catch(() => ({} as Record<string, string>)),
        configApi.get().catch(() => ({} as Record<string, string>)),
      ]);
      setAboutContent(portfolioMap.about || '');
      setConfig(siteConfig);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleOpenResume = () => {
    if (!onOpenRequest) return;
    onOpenRequest({
      type: 'open',
      appId: 'pdf-viewer',
      title: 'Resume.pdf',
      path: '/home/pratyush/resume.pdf',
    });
  };

  const handleOpenApp = (appId: string, title: string) => {
    if (!onOpenRequest) return;
    onOpenRequest({
      type: 'open',
      appId,
      title,
    });
  };

  const siteName = config.site_name || 'Pratyush Robert';
  const siteTitle = config.site_title || 'Software Engineer & Security Researcher';
  const siteDescription = config.site_description || '';
  const rawGithub = config.contact_github?.trim();
  const githubLink = rawGithub && rawGithub !== 'https://github.com/' && rawGithub !== 'https://github.com'
    ? rawGithub
    : 'https://github.com/pratyushrobert';
  const rawLinkedin = config.contact_linkedin?.trim();
  const linkedinLink = rawLinkedin && rawLinkedin !== 'https://linkedin.com/' && rawLinkedin !== 'https://linkedin.com'
    ? rawLinkedin
    : undefined;
  const websiteLink = config.contact_website?.trim() || undefined;

  return (
    <div className="portfolio-window">
      {/* Toolbar */}
      <div className="portfolio-toolbar">
        <div className="portfolio-toolbar-group">
          <User size={16} className="portfolio-accent-icon" />
          <span style={{ fontWeight: 600, color: 'var(--text-h)' }}>About Developer</span>
        </div>

        <div className="portfolio-toolbar-group">
          <button
            className="portfolio-btn"
            onClick={() => void fetchData()}
            disabled={loading}
            title="Refresh profile from database"
          >
            <RefreshCw size={13} className={loading ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="portfolio-content">
        {loading ? (
          <div className="portfolio-state-box">
            <Loader2 size={32} className="spinning" />
            <div className="portfolio-state-title">Loading Profile...</div>
          </div>
        ) : error ? (
          <div className="portfolio-state-box error">
            <AlertCircle size={36} className="state-icon" />
            <div className="portfolio-state-title">Unable to Load Profile</div>
            <div className="portfolio-state-desc">{error}</div>
            <button className="portfolio-btn" onClick={() => void fetchData()}>
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        ) : (
          <div className="about-container">
            {/* Hero Profile Card */}
            <div className="about-hero-card">
              <div className="about-avatar-box">
                <User size={38} />
              </div>

              <div className="about-identity">
                <h2 className="about-name">{siteName}</h2>
                {siteTitle && <div className="about-title">{siteTitle}</div>}
                {siteDescription && <div className="about-tagline">{siteDescription}</div>}
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="about-actions-card">
              <button className="portfolio-btn portfolio-btn-primary" onClick={handleOpenResume} title="View Resume PDF">
                <FileText size={14} />
                <span>Open Resume (PDF)</span>
              </button>

              <button className="portfolio-btn" onClick={() => handleOpenApp('projects', 'Projects')} title="Explore Projects">
                <FolderGit2 size={14} />
                <span>Projects</span>
              </button>

              <button className="portfolio-btn" onClick={() => handleOpenApp('skills', 'Skills')} title="View Skills">
                <Cpu size={14} />
                <span>Skills</span>
              </button>

              <button className="portfolio-btn" onClick={() => handleOpenApp('contact', 'Contact')} title="Get in touch">
                <Mail size={14} />
                <span>Contact</span>
              </button>

              {githubLink && isValidUrl(githubLink) && (
                <a
                  href={githubLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="portfolio-btn"
                  title="Visit GitHub profile"
                >
                  <ExternalLink size={14} />
                  <span>GitHub ↗</span>
                </a>
              )}

              {linkedinLink && isValidUrl(linkedinLink) && (
                <a
                  href={linkedinLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="portfolio-btn"
                  title="Visit LinkedIn profile"
                >
                  <ExternalLink size={14} />
                  <span>LinkedIn ↗</span>
                </a>
              )}

              {websiteLink && isValidUrl(websiteLink) && (
                <a
                  href={websiteLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="portfolio-btn"
                  title="Visit personal website"
                >
                  <ExternalLink size={14} />
                  <span>Website ↗</span>
                </a>
              )}
            </div>

            {/* Main About Bio Content */}
            {aboutContent ? (
              <div
                className="about-content-card"
                dangerouslySetInnerHTML={{ __html: renderMarkdownSafe(aboutContent) }}
              />
            ) : (
              <div
                className="about-content-card"
                style={{ color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center' }}
              >
                No biography content has been configured in the Admin Portal yet.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
