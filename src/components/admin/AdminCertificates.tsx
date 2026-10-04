import { useState } from 'react';
import { useAdminConfig, useBuiltInAssets } from '../../lib/admin/useAdminConfig';
import { vfs } from '../../lib/vfs';
import { Plus, Trash2, Eye, Download, Save, Loader2, Edit } from 'lucide-react';

export function AdminCertificates() {
  const { config, updateConfig } = useAdminConfig();
  const { assets } = useBuiltInAssets();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [newCert, setNewCert] = useState({
    name: '',
    issuer: '',
    date: '',
    description: '',
    assetPath: '',
    link: '',
  });

  const handleEdit = (cert: typeof config.certificates[0]) => {
    setEditingId(cert.id);
    setNewCert({
      name: cert.name,
      issuer: cert.issuer,
      date: cert.date,
      description: cert.description || '',
      assetPath: cert.assetPath || '',
      link: cert.link || '',
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setShowAddForm(false);
    setNewCert({
      name: '',
      issuer: '',
      date: '',
      description: '',
      assetPath: '',
      link: '',
    });
  };

  const handleSave = async (certId: string) => {
    setSaving(true);
    try {
      const updates = {
        name: newCert.name,
        issuer: newCert.issuer,
        date: newCert.date,
        description: newCert.description,
        assetPath: newCert.assetPath,
        link: newCert.link,
      };

      updateConfig(prev => ({
        ...prev,
        certificates: prev.certificates.map(c =>
          c.id === certId ? { ...c, ...updates } : c
        ),
      }));

      handleCancel();
      alert('Certificate saved!');
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save certificate');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!newCert.name.trim() || !newCert.issuer.trim()) return;

    setSaving(true);
    try {
      const newId = newCert.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

      if (config.certificates.some(c => c.id === newId)) {
        alert('Certificate with this name already exists');
        setSaving(false);
        return;
      }

      const newCertData = {
        id: newId,
        name: newCert.name,
        issuer: newCert.issuer,
        date: newCert.date,
        description: newCert.description,
        assetPath: newCert.assetPath,
        link: newCert.link,
        order: config.certificates.length + 1,
        visibility: true,
      };

      updateConfig(prev => ({
        ...prev,
        certificates: [...prev.certificates, newCertData],
      }));

      handleCancel();
      alert('Certificate added!');
    } catch (err) {
      console.error('Create failed:', err);
      alert('Failed to add certificate');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (certId: string) => {
    if (!confirm('Delete this certificate?')) return;

    try {
      // If assetPath exists and is a built-in asset, also remove from VFS
      const cert = config.certificates.find(c => c.id === certId);
      if (cert?.assetPath) {
        const state = vfs.getState();
        const nodeEntry = Object.entries(state.nodes).find(
          ([, node]) => node.type === 'file' && node.assetPath === cert.assetPath
        );
        if (nodeEntry) {
          const [nodeId, node] = nodeEntry;
          if (node.parentId) {
            const parent = state.nodes[node.parentId];
            if (parent && 'children' in parent) {
              parent.children = parent.children.filter(id => id !== nodeId);
            }
          }
          delete state.nodes[nodeId];
          // Trigger reactivity
          vfs.getState().nodes = { ...vfs.getState().nodes };
        }
      }

      updateConfig(prev => ({
        ...prev,
        certificates: prev.certificates.filter(c => c.id !== certId),
      }));

      alert('Certificate deleted');
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete certificate');
    }
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>Certificates</h2>
        <button
          className="admin-btn admin-btn-primary"
          onClick={() => setShowAddForm(true)}
        >
          <Plus size={16} /> Add Certificate
        </button>
      </div>

      {showAddForm && (
        <div className="admin-card admin-form-card">
          <h3>Add Certificate</h3>
          <div className="admin-form-grid">
            <div className="admin-form-field">
              <label>Name *</label>
              <input
                type="text"
                value={newCert.name}
                onChange={e => setNewCert({ ...newCert, name: e.target.value })}
                placeholder="Certificate Name"
                className="admin-input"
              />
            </div>
            <div className="admin-form-field">
              <label>Issuer *</label>
              <input
                type="text"
                value={newCert.issuer}
                onChange={e => setNewCert({ ...newCert, issuer: e.target.value })}
                placeholder="Issuing Organization"
                className="admin-input"
              />
            </div>
            <div className="admin-form-field">
              <label>Date (YYYY-MM)</label>
              <input
                type="month"
                value={newCert.date}
                onChange={e => setNewCert({ ...newCert, date: e.target.value })}
                className="admin-input"
              />
            </div>
            <div className="admin-form-field admin-form-field-full">
              <label>Description</label>
              <textarea
                value={newCert.description}
                onChange={e => setNewCert({ ...newCert, description: e.target.value })}
                placeholder="Optional description..."
                className="admin-textarea"
                rows={2}
              />
            </div>
            <div className="admin-form-field admin-form-field-full">
              <label>Asset Path (optional)</label>
              <input
                type="text"
                value={newCert.assetPath}
                onChange={e => setNewCert({ ...newCert, assetPath: e.target.value })}
                placeholder="/portfolio/documents/certificate.pdf"
                className="admin-input"
              />
            </div>
            <div className="admin-form-field admin-form-field-full">
              <label>Link (optional)</label>
              <input
                type="url"
                value={newCert.link}
                onChange={e => setNewCert({ ...newCert, link: e.target.value })}
                placeholder="https://verify.example.com/..."
                className="admin-input"
              />
            </div>
            <div className="admin-form-actions">
              <button className="admin-btn admin-btn-secondary" onClick={handleCancel}>Cancel</button>
              <button className="admin-btn admin-btn-primary" onClick={handleAdd} disabled={saving || !newCert.name.trim() || !newCert.issuer.trim()}>
                <Save size={16} /> Add Certificate
              </button>
            </div>
          </div>
        </div>
      )}

      {config.certificates.length === 0 ? (
        <div className="admin-empty-state">
          <span className="admin-empty-icon">📜</span>
          <p>No certificates configured yet.</p>
          <p className="admin-hint">Click "Add Certificate" to add your first certificate.</p>
        </div>
      ) : (
        <div className="admin-certificate-list">
          {config.certificates.map(cert => (
            <div key={cert.id} className="admin-certificate-card">
              <div className="admin-certificate-header">
                <div>
                  <h4>{cert.name}</h4>
                  <div className="admin-certificate-meta">
                    <span className="admin-badge">Issuer: {cert.issuer}</span>
                    <span>{cert.date}</span>
                    {cert.assetPath && <span className="admin-badge">Has Asset</span>}
                  </div>
                </div>
                <div className="admin-certificate-actions">
                  <button className="admin-icon-btn" onClick={() => handleEdit(cert)} title="Edit">
                    <Edit size={16} />
                  </button>
                  <button className="admin-icon-btn admin-icon-btn-danger" onClick={() => handleDelete(cert.id)} title="Delete">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {editingId === cert.id && (
                <div className="admin-edit-form">
                  <div className="admin-form-grid">
                    <div className="admin-form-field">
                      <label>Name *</label>
                      <input
                        type="text"
                        value={newCert.name}
                        onChange={e => setNewCert({ ...newCert, name: e.target.value })}
                        className="admin-input"
                      />
                    </div>
                    <div className="admin-form-field">
                      <label>Issuer *</label>
                      <input
                        type="text"
                        value={newCert.issuer}
                        onChange={e => setNewCert({ ...newCert, issuer: e.target.value })}
                        className="admin-input"
                      />
                    </div>
                    <div className="admin-form-field">
                      <label>Date (YYYY-MM)</label>
                      <input
                        type="month"
                        value={newCert.date}
                        onChange={e => setNewCert({ ...newCert, date: e.target.value })}
                        className="admin-input"
                      />
                    </div>
                    <div className="admin-form-field admin-form-field-full">
                      <label>Description</label>
                      <textarea
                        value={newCert.description}
                        onChange={e => setNewCert({ ...newCert, description: e.target.value })}
                        className="admin-textarea"
                        rows={2}
                      />
                    </div>
                    <div className="admin-form-field admin-form-field-full">
                      <label>Asset Path (optional)</label>
                      <input
                        type="text"
                        value={newCert.assetPath}
                        onChange={e => setNewCert({ ...newCert, assetPath: e.target.value })}
                        className="admin-input"
                      />
                    </div>
                    <div className="admin-form-field admin-form-field-full">
                      <label>Link (optional)</label>
                      <input
                        type="url"
                        value={newCert.link}
                        onChange={e => setNewCert({ ...newCert, link: e.target.value })}
                        className="admin-input"
                      />
                    </div>
                    <div className="admin-form-actions">
                      <button className="admin-btn admin-btn-secondary" onClick={handleCancel}>Cancel</button>
                      <button className="admin-btn admin-btn-primary" onClick={() => handleSave(cert.id)} disabled={saving}>
                        {saving ? <Loader2 size={16} /> : <Save size={16} />} Save
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="admin-certificate-preview">
                <p>{cert.description || 'No description'}</p>
                {cert.link && (
                  <a href={cert.link} target="_blank" rel="noopener noreferrer" className="admin-link">
                    Verify Certificate
                  </a>
                )}
                {cert.assetPath && (
                  <div className="admin-certificate-asset">
                    <button className="admin-btn admin-btn-secondary" onClick={() => window.open(cert.assetPath!, '_blank')}>
                      <Eye size={16} /> View Asset
                    </button>
                    <button className="admin-btn admin-btn-secondary" onClick={() => {
                      const link = document.createElement('a');
                      link.href = cert.assetPath!;
                      link.download = cert.name;
                      link.click();
                    }}>
                      <Download size={16} /> Download
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}