import { useState, useEffect } from 'react';
import { configApi } from '../../lib/api/config';
import { getApiErrorMessage } from '../../lib/api/client';
import {
  Sliders,
  Save,
  Loader2,
  Check,
  Mail,
  Globe,
  Share2,
  Tag,
  Info,
  RefreshCw,
} from 'lucide-react';
import './AdminPortal.css';

interface ConfigFormData {
  site_name: string;
  site_title: string;
  site_description: string;
  site_keywords: string;
  contact_email: string;
  contact_github: string;
  contact_linkedin: string;
  contact_website: string;
}

const emptyConfig: ConfigFormData = {
  site_name: '',
  site_title: '',
  site_description: '',
  site_keywords: '',
  contact_email: '',
  contact_github: '',
  contact_linkedin: '',
  contact_website: '',
};

export function AdminSiteConfig() {
  const [formData, setFormData] = useState<ConfigFormData>(emptyConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await configApi.get();
      setFormData({
        site_name: data.site_name || '',
        site_title: data.site_title || '',
        site_description: data.site_description || '',
        site_keywords: data.site_keywords || '',
        contact_email: data.contact_email || '',
        contact_github: data.contact_github || '',
        contact_linkedin: data.contact_linkedin || '',
        contact_website: data.contact_website || '',
      });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const items = [
      { key: 'site_name', value: formData.site_name.trim(), description: 'Portfolio owner display name' },
      { key: 'site_title', value: formData.site_title.trim(), description: 'Primary professional title' },
      { key: 'site_description', value: formData.site_description.trim(), description: 'Site tagline and meta description' },
      { key: 'site_keywords', value: formData.site_keywords.trim(), description: 'Comma-separated keywords' },
      { key: 'contact_email', value: formData.contact_email.trim(), description: 'Primary contact email' },
      { key: 'contact_github', value: formData.contact_github.trim(), description: 'GitHub profile URL' },
      { key: 'contact_linkedin', value: formData.contact_linkedin.trim(), description: 'LinkedIn profile URL' },
      { key: 'contact_website', value: formData.contact_website.trim(), description: 'Personal website URL' },
    ];

    try {
      await configApi.saveMany(items);
      setSuccess('Site configuration saved to database successfully!');
      setTimeout(() => setSuccess(null), 3500);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-section" style={{ maxWidth: 840 }}>
      <div className="admin-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2>Site Configuration</h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Manage site identity, meta descriptions, and contact channels stored in SQLite
          </span>
        </div>
        <button
          className="admin-btn admin-btn-secondary"
          onClick={() => void loadConfig()}
          disabled={loading || saving}
          title="Reload configuration from server"
        >
          <RefreshCw size={14} className={loading ? 'spinning' : ''} />
          <span>Reload</span>
        </button>
      </div>

      {success && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(46, 204, 113, 0.15)', border: '1px solid rgba(46, 204, 113, 0.3)', borderRadius: 6, color: '#2ecc71', marginBottom: 16 }}>
          <Check size={16} />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(231, 76, 60, 0.15)', border: '1px solid rgba(231, 76, 60, 0.3)', borderRadius: 6, color: '#e74c3c', marginBottom: 16 }}>
          <Info size={16} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 32, color: 'var(--text-muted)' }}>
          <Loader2 className="spinning" size={20} />
          <span>Loading configuration...</span>
        </div>
      ) : (
        <form onSubmit={handleSave}>
          {/* Section 1: Site Identity */}
          <div className="admin-card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Sliders size={18} style={{ color: 'var(--accent)' }} />
              <h3 style={{ margin: 0, fontSize: 15 }}>Site Identity & Profile</h3>
            </div>

            <div className="admin-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
              <div className="admin-form-field">
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                  Site Name / Display Name
                </label>
                <input
                  type="text"
                  value={formData.site_name}
                  onChange={(e) => setFormData({ ...formData, site_name: e.target.value })}
                  placeholder="e.g. Pratyush Robert"
                  className="admin-input"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                />
              </div>

              <div className="admin-form-field">
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                  Professional Title / Headline
                </label>
                <input
                  type="text"
                  value={formData.site_title}
                  onChange={(e) => setFormData({ ...formData, site_title: e.target.value })}
                  placeholder="e.g. Full-stack Developer & Security Researcher"
                  className="admin-input"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                />
              </div>

              <div className="admin-form-field" style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                  Tagline / Bio Summary
                </label>
                <input
                  type="text"
                  value={formData.site_description}
                  onChange={(e) => setFormData({ ...formData, site_description: e.target.value })}
                  placeholder="e.g. Building creative web experiences & secure systems"
                  className="admin-input"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                />
              </div>

              <div className="admin-form-field" style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                  <Tag size={13} />
                  <span>Keywords (comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={formData.site_keywords}
                  onChange={(e) => setFormData({ ...formData, site_keywords: e.target.value })}
                  placeholder="React, TypeScript, Node.js, Python, Security, MimiOS"
                  className="admin-input"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Contact & Social Channels */}
          <div className="admin-card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Mail size={18} style={{ color: 'var(--accent)' }} />
              <h3 style={{ margin: 0, fontSize: 15 }}>Contact Channels & Social Links</h3>
            </div>

            <div className="admin-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
              <div className="admin-form-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                  <Mail size={13} />
                  <span>Contact Email</span>
                </label>
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  placeholder="e.g. contact@example.com"
                  className="admin-input"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                />
              </div>

              <div className="admin-form-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                  <Share2 size={13} />
                  <span>GitHub Profile URL</span>
                </label>
                <input
                  type="url"
                  value={formData.contact_github}
                  onChange={(e) => setFormData({ ...formData, contact_github: e.target.value })}
                  placeholder="https://github.com/pratyushrobert"
                  className="admin-input"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                />
              </div>

              <div className="admin-form-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                  <Share2 size={13} />
                  <span>LinkedIn Profile URL</span>
                </label>
                <input
                  type="url"
                  value={formData.contact_linkedin}
                  onChange={(e) => setFormData({ ...formData, contact_linkedin: e.target.value })}
                  placeholder="https://linkedin.com/in/..."
                  className="admin-input"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                />
              </div>

              <div className="admin-form-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                  <Globe size={13} />
                  <span>Personal Website URL</span>
                </label>
                <input
                  type="url"
                  value={formData.contact_website}
                  onChange={(e) => setFormData({ ...formData, contact_website: e.target.value })}
                  placeholder="https://example.com"
                  className="admin-input"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button
              type="submit"
              className="admin-btn admin-btn-primary"
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', fontSize: 13 }}
            >
              {saving ? <Loader2 size={16} className="spinning" /> : <Save size={16} />}
              <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
