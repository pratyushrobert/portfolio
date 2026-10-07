import { useState, useEffect, useCallback, useMemo } from 'react';
import { certificatesApi, type Certificate } from '../../lib/api/certificates';
import { getApiErrorMessage } from '../../lib/api/client';
import {
  Award,
  ExternalLink,
  Calendar,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { isValidUrl } from '../../lib/portfolioUtils';
import type { DesktopOpenRequest } from '../../types/desktop';
import './Portfolio.css';

interface CertificatesAppProps {
  windowId: string;
  onOpenRequest?: (request: DesktopOpenRequest) => void;
}

export function CertificatesApp({ windowId: _windowId, onOpenRequest }: CertificatesAppProps) {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCertificates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await certificatesApi.list();
      const sorted = [...data].sort((a, b) => {
        if ((a.sort_order ?? 0) !== (b.sort_order ?? 0)) {
          return (a.sort_order ?? 0) - (b.sort_order ?? 0);
        }
        return (b.date || '').localeCompare(a.date || '');
      });
      setCertificates(sorted);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCertificates();
  }, [fetchCertificates]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return certificates;
    const q = searchQuery.toLowerCase();
    return certificates.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.issuer.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [certificates, searchQuery]);

  const handleOpenCertificateAsset = (cert: Certificate) => {
    if (!cert.asset_id || !onOpenRequest) return;
    // Determine asset URL path from server uploads
    const assetUrl = `/uploads/${cert.asset_id}`;
    onOpenRequest({
      type: 'open',
      appId: 'image-viewer',
      title: `${cert.name} — Certificate`,
      path: assetUrl,
      params: { path: assetUrl },
    });
  };

  return (
    <div className="portfolio-window">
      {/* Toolbar */}
      <div className="portfolio-toolbar">
        <div className="portfolio-toolbar-group">
          <div className="portfolio-search-input">
            <Search size={14} style={{ opacity: 0.6 }} />
            <input
              type="text"
              placeholder="Search certificates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="portfolio-toolbar-group">
          <button
            className="portfolio-btn"
            onClick={() => void fetchCertificates()}
            disabled={loading}
            title="Refresh certificates from database"
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
            <div className="portfolio-state-title">Loading Certificates...</div>
          </div>
        ) : error ? (
          <div className="portfolio-state-box error">
            <AlertCircle size={36} className="state-icon" />
            <div className="portfolio-state-title">Unable to Load Certificates</div>
            <div className="portfolio-state-desc">{error}</div>
            <button className="portfolio-btn" onClick={() => void fetchCertificates()}>
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        ) : certificates.length === 0 ? (
          <div className="portfolio-state-box">
            <Award size={40} className="state-icon" />
            <div className="portfolio-state-title">No Certificates Published Yet</div>
            <div className="portfolio-state-desc">
              Certificates added and published in the Admin Portal will appear here.
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="portfolio-state-box">
            <Search size={36} className="state-icon" />
            <div className="portfolio-state-title">No Matching Certificates</div>
            <div className="portfolio-state-desc">No certificates match "{searchQuery}".</div>
          </div>
        ) : (
          <div className="certificates-grid">
            {filtered.map((cert) => (
              <div key={cert.id} className="certificate-card">
                <div className="certificate-header">
                  <Award size={24} className="certificate-icon" />
                  <div className="certificate-title-group">
                    <h3 className="certificate-name">{cert.name}</h3>
                    <span className="certificate-issuer">Issued by {cert.issuer}</span>
                  </div>
                </div>

                {cert.description && <p className="certificate-desc">{cert.description}</p>}

                <div className="certificate-footer">
                  <div className="certificate-date">
                    <Calendar size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                    {cert.date}
                  </div>

                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {cert.asset_id && (
                      <button
                        className="portfolio-btn"
                        onClick={() => handleOpenCertificateAsset(cert)}
                        title="View certificate document in MimiOS viewer"
                        style={{ padding: '3px 8px', fontSize: '11px' }}
                      >
                        <FileCheck size={12} />
                        <span>View Asset</span>
                      </button>
                    )}
                    {cert.link && isValidUrl(cert.link) && (
                      <a
                        href={cert.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="portfolio-btn portfolio-btn-primary"
                        title="Verify credential online"
                        style={{ padding: '3px 8px', fontSize: '11px' }}
                      >
                        <ExternalLink size={12} />
                        <span>Verify ↗</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
