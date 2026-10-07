import { useState, useEffect, useCallback } from 'react';
import { configApi } from '../../lib/api/config';
import { portfolioApi } from '../../lib/api/portfolio';
import { getApiErrorMessage } from '../../lib/api/client';
import {
  Mail,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  AlertCircle,
  Globe,
  Share2,
} from 'lucide-react';
import { isValidUrl, renderMarkdownSafe } from '../../lib/portfolioUtils';
import './Portfolio.css';

interface ContactAppProps {
  windowId: string;
}

export function ContactApp({ windowId: _windowId }: ContactAppProps) {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [contactNote, setContactNote] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchContact = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [siteConfig, portfolioMap] = await Promise.all([
        configApi.get().catch(() => ({} as Record<string, string>)),
        portfolioApi.get().catch(() => ({} as Record<string, string>)),
      ]);
      setConfig(siteConfig);
      setContactNote(portfolioMap.contact || '');
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchContact();
  }, [fetchContact]);

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // clipboard fallback
    }
  };

  const email = config.contact_email?.trim();
  const rawGithub = config.contact_github?.trim();
  const github = rawGithub && rawGithub !== 'https://github.com/' && rawGithub !== 'https://github.com'
    ? rawGithub
    : 'https://github.com/pratyushrobert';
  const rawLinkedin = config.contact_linkedin?.trim();
  const linkedin = rawLinkedin && rawLinkedin !== 'https://linkedin.com/' && rawLinkedin !== 'https://linkedin.com'
    ? rawLinkedin
    : undefined;
  const website = config.contact_website?.trim() || undefined;

  const hasAnyChannel = Boolean(email || github || linkedin || website);

  return (
    <div className="portfolio-window">
      {/* Toolbar */}
      <div className="portfolio-toolbar">
        <div className="portfolio-toolbar-group">
          <Mail size={16} className="portfolio-accent-icon" />
          <span style={{ fontWeight: 600, color: 'var(--text-h)' }}>Contact & Communications</span>
        </div>

        <div className="portfolio-toolbar-group">
          <button
            className="portfolio-btn"
            onClick={() => void fetchContact()}
            disabled={loading}
            title="Refresh contact info from database"
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
            <div className="portfolio-state-title">Loading Contact Channels...</div>
          </div>
        ) : error ? (
          <div className="portfolio-state-box error">
            <AlertCircle size={36} className="state-icon" />
            <div className="portfolio-state-title">Unable to Load Contact Details</div>
            <div className="portfolio-state-desc">{error}</div>
            <button className="portfolio-btn" onClick={() => void fetchContact()}>
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        ) : !hasAnyChannel && !contactNote ? (
          <div className="portfolio-state-box">
            <Mail size={40} className="state-icon" />
            <div className="portfolio-state-title">No Contact Information Configured</div>
            <div className="portfolio-state-desc">
              Contact details can be configured in the Admin Portal under Settings.
            </div>
          </div>
        ) : (
          <div className="contact-container">
            <div className="contact-header">
              <h2>Get in Touch</h2>
              <p>Connect across any of the verified channels below.</p>
            </div>

            <div className="contact-cards-list">
              {email && (
                <div className="contact-card-item">
                  <div className="contact-card-left">
                    <Mail size={22} className="contact-card-icon" />
                    <div className="contact-card-info">
                      <span className="contact-card-label">Email Address</span>
                      <a href={`mailto:${email}`} className="contact-card-value">
                        {email}
                      </a>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="portfolio-btn"
                      onClick={() => handleCopy('email', email)}
                      title="Copy email address"
                    >
                      {copiedKey === 'email' ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedKey === 'email' ? 'Copied' : 'Copy'}</span>
                    </button>
                    <a
                      href={`mailto:${email}`}
                      className="portfolio-btn portfolio-btn-primary"
                      title="Compose email"
                    >
                      <ExternalLink size={13} />
                      <span>Send</span>
                    </a>
                  </div>
                </div>
              )}

              {github && isValidUrl(github) && (
                <div className="contact-card-item">
                  <div className="contact-card-left">
                    <Share2 size={22} className="contact-card-icon" />
                    <div className="contact-card-info">
                      <span className="contact-card-label">GitHub Profile</span>
                      <a href={github} target="_blank" rel="noopener noreferrer" className="contact-card-value">
                        {github}
                      </a>
                    </div>
                  </div>

                  <a
                    href={github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="portfolio-btn"
                    title="Open GitHub profile"
                  >
                    <ExternalLink size={13} />
                    <span>Visit ↗</span>
                  </a>
                </div>
              )}

              {linkedin && isValidUrl(linkedin) && (
                <div className="contact-card-item">
                  <div className="contact-card-left">
                    <Share2 size={22} className="contact-card-icon" />
                    <div className="contact-card-info">
                      <span className="contact-card-label">LinkedIn Profile</span>
                      <a href={linkedin} target="_blank" rel="noopener noreferrer" className="contact-card-value">
                        {linkedin}
                      </a>
                    </div>
                  </div>

                  <a
                    href={linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="portfolio-btn"
                    title="Open LinkedIn profile"
                  >
                    <ExternalLink size={13} />
                    <span>Visit ↗</span>
                  </a>
                </div>
              )}

              {website && isValidUrl(website) && (
                <div className="contact-card-item">
                  <div className="contact-card-left">
                    <Globe size={22} className="contact-card-icon" />
                    <div className="contact-card-info">
                      <span className="contact-card-label">Website</span>
                      <a href={website} target="_blank" rel="noopener noreferrer" className="contact-card-value">
                        {website}
                      </a>
                    </div>
                  </div>

                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="portfolio-btn"
                    title="Visit website"
                  >
                    <ExternalLink size={13} />
                    <span>Visit ↗</span>
                  </a>
                </div>
              )}
            </div>

            {/* Custom Contact Note if set in portfolio_content */}
            {contactNote && (
              <div
                className="contact-note-box"
                dangerouslySetInnerHTML={{ __html: renderMarkdownSafe(contactNote) }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
