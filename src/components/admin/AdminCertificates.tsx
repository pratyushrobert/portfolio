import { useEffect, useState } from 'react';
import { certificatesApi, type Certificate, type CertificateInput } from '../../lib/api/certificates';
import { assetsApi, type PortfolioAsset } from '../../lib/api/assets';
import { getApiErrorMessage } from '../../lib/api/client';
import {
  Plus,
  Trash2,
  Save,
  Loader2,
  Edit,
  ExternalLink,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  X,
} from 'lucide-react';
import './AdminCertificates.css';

interface CertificateFormData {
  name: string;
  issuer: string;
  date: string;
  description: string;
  asset_id: string;
  link: string;
  sort_order: number;
  visibility: boolean;
}

const emptyFormData: CertificateFormData = {
  name: '',
  issuer: '',
  date: '',
  description: '',
  asset_id: '',
  link: '',
  sort_order: 0,
  visibility: true,
};

export function AdminCertificates() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [assets, setAssets] = useState<PortfolioAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<CertificateFormData>(emptyFormData);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [certsData, assetsData] = await Promise.all([
        certificatesApi.listAdmin(),
        assetsApi.listAdmin().catch(() => [] as PortfolioAsset[]),
      ]);
      setCertificates(certsData);
      setAssets(assetsData);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      ...emptyFormData,
      sort_order: certificates.length,
    });
    setShowModal(true);
    setError(null);
  };

  const handleEdit = (cert: Certificate) => {
    setEditingId(cert.id);
    setFormData({
      name: cert.name,
      issuer: cert.issuer,
      date: cert.date,
      description: cert.description || '',
      asset_id: cert.asset_id || '',
      link: cert.link || '',
      sort_order: cert.sort_order,
      visibility: cert.visibility,
    });
    setShowModal(true);
    setError(null);
  };

  const handleCloseModal = () => {
    setEditingId(null);
    setShowModal(false);
    setFormData(emptyFormData);
    setError(null);
  };

  const buildPayload = (data: CertificateFormData): CertificateInput => ({
    name: data.name.trim(),
    issuer: data.issuer.trim(),
    date: data.date.trim(),
    description: data.description.trim() ? data.description.trim() : null,
    asset_id: data.asset_id.trim() ? data.asset_id.trim() : null,
    link: data.link.trim() ? data.link.trim() : null,
    sort_order: Number(data.sort_order) || 0,
    visibility: data.visibility,
  });

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.issuer.trim() || !formData.date.trim()) {
      setError('Name, Issuer, and Date are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload(formData);
      if (editingId) {
        const updated = await certificatesApi.update(editingId, payload);
        setCertificates(prev => prev.map(c => (c.id === editingId ? updated : c)));
        showNotification(`Certificate "${updated.name}" updated.`);
      } else {
        const created = await certificatesApi.create(payload);
        setCertificates(prev => [...prev, created]);
        showNotification(`Certificate "${created.name}" created.`);
      }
      handleCloseModal();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVisibility = async (cert: Certificate) => {
    try {
      const nextVis = !cert.visibility;
      const updated = await certificatesApi.update(cert.id, { visibility: nextVis });
      setCertificates(prev => prev.map(c => (c.id === cert.id ? updated : c)));
      showNotification(`Certificate "${cert.name}" is now ${nextVis ? 'Public' : 'Hidden'}.`);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const handleMove = async (cert: Certificate, direction: 'up' | 'down') => {
    const sorted = [...certificates].sort((a, b) => a.sort_order - b.sort_order);
    const index = sorted.findIndex(c => c.id === cert.id);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const otherCert = sorted[targetIndex];
    const currentOrder = cert.sort_order;
    const targetOrder = otherCert.sort_order === currentOrder
      ? (direction === 'up' ? currentOrder - 1 : currentOrder + 1)
      : otherCert.sort_order;

    try {
      const [u1, u2] = await Promise.all([
        certificatesApi.update(cert.id, { sort_order: targetOrder }),
        certificatesApi.update(otherCert.id, { sort_order: currentOrder }),
      ]);

      setCertificates(prev =>
        prev.map(c => {
          if (c.id === cert.id) return u1;
          if (c.id === otherCert.id) return u2;
          return c;
        })
      );
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const handleDelete = async (cert: Certificate) => {
    if (!window.confirm(`Are you sure you want to delete certificate "${cert.name}"?`)) return;
    setError(null);
    try {
      await certificatesApi.remove(cert.id);
      setCertificates(prev => prev.filter(c => c.id !== cert.id));
      showNotification(`Deleted certificate "${cert.name}".`);
      if (editingId === cert.id) handleCloseModal();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const sortedCertificates = [...certificates].sort((a, b) => a.sort_order - b.sort_order);

  const filteredCertificates = sortedCertificates.filter(cert => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      cert.name.toLowerCase().includes(q) ||
      cert.issuer.toLowerCase().includes(q) ||
      (cert.description && cert.description.toLowerCase().includes(q))
    );
  });

  // Map asset IDs to asset objects for quick lookup
  const assetMap = new Map<string, PortfolioAsset>();
  for (const a of assets) {
    assetMap.set(a.id, a);
  }

  // Document/image assets suitable for linking
  const linkableAssets = assets.filter(a => a.category === 'document' || a.category === 'image');

  return (
    <div className="admin-section" style={{ maxWidth: 960 }}>
      <div className="admin-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2>Certifications & Credentials</h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Manage verified certifications, issuing authorities, credential links, and attached PDFs/images
          </span>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={handleOpenAdd} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> Add Certificate
        </button>
      </div>

      {successMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(46, 204, 113, 0.15)', border: '1px solid rgba(46, 204, 113, 0.3)', borderRadius: 6, color: '#2ecc71', marginBottom: 16 }}>
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(231, 76, 60, 0.15)', border: '1px solid rgba(231, 76, 60, 0.3)', borderRadius: 6, color: '#e74c3c', marginBottom: 16 }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Stats & Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Total Certificates: <strong>{certificates.length}</strong> (Public: {certificates.filter(c => c.visibility).length})
        </div>

        <div style={{ position: 'relative', minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="admin-input"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search certificates or issuers..."
            style={{ paddingLeft: 30, fontSize: 12, height: 32 }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 32, color: 'var(--text-muted)' }}>
          <Loader2 className="spinning" size={20} />
          <span>Loading certificates from server...</span>
        </div>
      ) : certificates.length === 0 ? (
        <div className="admin-empty-state">
          <span className="admin-empty-icon">📜</span>
          <p>No certificates configured in database yet.</p>
          <p className="admin-hint">Click "Add Certificate" to register your achievements.</p>
        </div>
      ) : (
        <div className="admin-certificate-list" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredCertificates.map((cert, idx) => {
            const linkedAsset = cert.asset_id ? assetMap.get(cert.asset_id) : null;

            return (
              <div
                key={cert.id}
                className={`admin-certificate-card ${!cert.visibility ? 'hidden-card' : ''}`}
              >
                <div className="admin-certificate-header">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    {/* Reordering controls */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                      <button
                        className="admin-icon-btn small"
                        title="Move Up"
                        disabled={idx === 0}
                        onClick={() => void handleMove(cert, 'up')}
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        className="admin-icon-btn small"
                        title="Move Down"
                        disabled={idx === filteredCertificates.length - 1}
                        onClick={() => void handleMove(cert, 'down')}
                      >
                        <ArrowDown size={12} />
                      </button>
                    </div>

                    <div>
                      <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>{cert.name}</h4>
                      <div className="admin-certificate-meta" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span className="admin-badge" style={{ fontSize: 11 }}>
                          Issuer: {cert.issuer}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{cert.date}</span>
                        <span className={`admin-badge ${cert.visibility ? 'public' : 'draft'}`}>
                          {cert.visibility ? 'Public' : 'Hidden'}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Order: {cert.sort_order}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="admin-certificate-actions">
                    <button
                      className="admin-icon-btn"
                      title={cert.visibility ? 'Make Hidden' : 'Make Public'}
                      onClick={() => void handleToggleVisibility(cert)}
                    >
                      {cert.visibility ? <Eye size={15} style={{ color: '#2ecc71' }} /> : <EyeOff size={15} style={{ color: 'var(--text-muted)' }} />}
                    </button>
                    <button className="admin-icon-btn" onClick={() => handleEdit(cert)} title="Edit">
                      <Edit size={15} />
                    </button>
                    <button className="admin-icon-btn admin-icon-btn-danger" onClick={() => void handleDelete(cert)} title="Delete">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="admin-certificate-preview" style={{ padding: '12px 16px' }}>
                  {cert.description && (
                    <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.5, color: 'var(--text)' }}>
                      {cert.description}
                    </p>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
                    {linkedAsset && (
                      <a
                        href={linkedAsset.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="admin-link"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#feca57' }}
                      >
                        <FileText size={13} />
                        <span>Attached Document ({linkedAsset.name})</span>
                        <ExternalLink size={11} />
                      </a>
                    )}

                    {cert.link && (
                      <a
                        href={cert.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="admin-link"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--accent)' }}
                      >
                        <ExternalLink size={13} />
                        <span>Verify Credential</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="admin-modal-overlay" onClick={handleCloseModal}>
          <div className="admin-modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>{editingId ? 'Edit Certificate' : 'Add Certificate'}</h3>
              <button className="admin-icon-btn" onClick={handleCloseModal}>
                <X size={16} />
              </button>
            </div>

            <div className="admin-modal-body">
              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(231, 76, 60, 0.15)', border: '1px solid rgba(231, 76, 60, 0.3)', borderRadius: 6, color: '#e74c3c', marginBottom: 12 }}>
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}

              <div className="admin-form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="admin-form-field admin-form-field-full" style={{ gridColumn: '1 / -1' }}>
                  <label>Certificate Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Certified Information Systems Security Professional (CISSP)"
                    className="admin-input"
                    autoFocus
                  />
                </div>

                <div className="admin-form-field">
                  <label>Issuing Organization *</label>
                  <input
                    type="text"
                    value={formData.issuer}
                    onChange={e => setFormData({ ...formData, issuer: e.target.value })}
                    placeholder="e.g. (ISC)², Cisco, CompTIA, AWS"
                    className="admin-input"
                  />
                </div>

                <div className="admin-form-field">
                  <label>Issue Date * (YYYY-MM)</label>
                  <input
                    type="month"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="admin-input"
                  />
                </div>

                <div className="admin-form-field admin-form-field-full" style={{ gridColumn: '1 / -1' }}>
                  <label>Description & Scope</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Credential details, covered topics, score..."
                    className="admin-textarea"
                    rows={3}
                  />
                </div>

                {/* Linked Asset Selector */}
                <div className="admin-form-field admin-form-field-full" style={{ gridColumn: '1 / -1' }}>
                  <label>Attached Document / Certificate Asset (PDF or Image)</label>
                  <select
                    value={formData.asset_id}
                    onChange={e => setFormData({ ...formData, asset_id: e.target.value })}
                    className="admin-select"
                  >
                    <option value="">-- No Attached Asset --</option>
                    {linkableAssets.map(asset => (
                      <option key={asset.id} value={asset.id}>
                        [{asset.category.toUpperCase()}] {asset.name} ({Math.round(asset.size / 1024)} KB)
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    Tip: Upload certificate PDFs or badges in the "Portfolio Files" section first.
                  </span>
                </div>

                <div className="admin-form-field admin-form-field-full" style={{ gridColumn: '1 / -1' }}>
                  <label>Verification URL (optional)</label>
                  <input
                    type="url"
                    value={formData.link}
                    onChange={e => setFormData({ ...formData, link: e.target.value })}
                    placeholder="https://credly.com/badges/..."
                    className="admin-input"
                  />
                </div>

                <div className="admin-form-field">
                  <label>Sort Order</label>
                  <input
                    type="number"
                    value={formData.sort_order}
                    onChange={e => setFormData({ ...formData, sort_order: parseInt(e.target.value, 10) || 0 })}
                    className="admin-input"
                  />
                </div>

                <div className="admin-form-field" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
                    <input
                      type="checkbox"
                      checked={formData.visibility}
                      onChange={e => setFormData({ ...formData, visibility: e.target.checked })}
                    />
                    <span>Publicly Visible</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="admin-modal-footer">
              <button className="admin-btn admin-btn-secondary" onClick={handleCloseModal}>
                Cancel
              </button>
              <button
                className="admin-btn admin-btn-primary"
                onClick={() => void handleSave()}
                disabled={saving || !formData.name.trim() || !formData.issuer.trim() || !formData.date.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {saving ? <Loader2 size={15} className="spinning" /> : <Save size={15} />}
                <span>{editingId ? 'Save Changes' : 'Create Certificate'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}