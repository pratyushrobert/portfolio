import { useEffect, useState } from 'react';
import { experienceApi, type Experience, type ExperienceInput } from '../../lib/api/experience';
import { getApiErrorMessage } from '../../lib/api/client';
import {
  Plus,
  Save,
  Loader2,
  Trash2,
  Edit,
  Calendar,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Search,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  X,
} from 'lucide-react';
import './AdminExperience.css';

interface ExperienceFormData {
  organization: string;
  role: string;
  start_date: string;
  end_date: string;
  is_present: boolean;
  description: string;
  technologies: string;
  link: string;
  sort_order: number;
  visibility: boolean;
}

const emptyFormData: ExperienceFormData = {
  organization: '',
  role: '',
  start_date: '',
  end_date: '',
  is_present: false,
  description: '',
  technologies: '',
  link: '',
  sort_order: 0,
  visibility: true,
};

export function AdminExperience() {
  const [experience, setExperience] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<ExperienceFormData>(emptyFormData);
  const [searchQuery, setSearchQuery] = useState('');

  const loadExperience = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await experienceApi.listAdmin();
      setExperience(data);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadExperience();
  }, []);

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      ...emptyFormData,
      sort_order: experience.length,
    });
    setShowModal(true);
    setError(null);
  };

  const handleEdit = (exp: Experience) => {
    setEditingId(exp.id);
    setFormData({
      organization: exp.organization,
      role: exp.role,
      start_date: exp.start_date,
      end_date: exp.end_date || '',
      is_present: !exp.end_date,
      description: exp.description || '',
      technologies: (exp.technologies || []).join(', '),
      link: exp.link || '',
      sort_order: exp.sort_order,
      visibility: exp.visibility,
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

  const buildPayload = (data: ExperienceFormData): ExperienceInput => ({
    organization: data.organization.trim(),
    role: data.role.trim(),
    start_date: data.start_date.trim(),
    end_date: data.is_present || !data.end_date.trim() ? null : data.end_date.trim(),
    description: data.description.trim(),
    technologies: data.technologies
      .split(',')
      .map(t => t.trim())
      .filter(Boolean),
    link: data.link.trim() ? data.link.trim() : null,
    sort_order: Number(data.sort_order) || 0,
    visibility: data.visibility,
  });

  const handleSave = async () => {
    if (!formData.organization.trim() || !formData.role.trim() || !formData.start_date.trim()) {
      setError('Organization, Role, and Start Date are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload(formData);
      if (editingId) {
        const updated = await experienceApi.update(editingId, payload);
        setExperience(prev => prev.map(e => (e.id === editingId ? updated : e)));
        showNotification(`Experience position at "${updated.organization}" updated.`);
      } else {
        const created = await experienceApi.create(payload);
        setExperience(prev => [...prev, created]);
        showNotification(`Experience position at "${created.organization}" created.`);
      }
      handleCloseModal();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVisibility = async (exp: Experience) => {
    try {
      const nextVis = !exp.visibility;
      const updated = await experienceApi.update(exp.id, { visibility: nextVis });
      setExperience(prev => prev.map(e => (e.id === exp.id ? updated : e)));
      showNotification(`Position at "${exp.organization}" is now ${nextVis ? 'Public' : 'Hidden'}.`);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const handleMove = async (exp: Experience, direction: 'up' | 'down') => {
    const sorted = [...experience].sort((a, b) => a.sort_order - b.sort_order);
    const index = sorted.findIndex(e => e.id === exp.id);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const otherExp = sorted[targetIndex];
    const currentOrder = exp.sort_order;
    const targetOrder = otherExp.sort_order === currentOrder
      ? (direction === 'up' ? currentOrder - 1 : currentOrder + 1)
      : otherExp.sort_order;

    try {
      const [u1, u2] = await Promise.all([
        experienceApi.update(exp.id, { sort_order: targetOrder }),
        experienceApi.update(otherExp.id, { sort_order: currentOrder }),
      ]);

      setExperience(prev =>
        prev.map(e => {
          if (e.id === exp.id) return u1;
          if (e.id === otherExp.id) return u2;
          return e;
        })
      );
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const handleDelete = async (exp: Experience) => {
    if (!window.confirm(`Are you sure you want to delete experience entry for "${exp.organization}"?`)) return;
    setError(null);
    try {
      await experienceApi.remove(exp.id);
      setExperience(prev => prev.filter(e => e.id !== exp.id));
      showNotification(`Deleted experience entry for "${exp.organization}".`);
      if (editingId === exp.id) handleCloseModal();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const sortedExperience = [...experience].sort((a, b) => a.sort_order - b.sort_order);

  const filteredExperience = sortedExperience.filter(exp => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      exp.organization.toLowerCase().includes(q) ||
      exp.role.toLowerCase().includes(q) ||
      (exp.technologies && exp.technologies.some(t => t.toLowerCase().includes(q))) ||
      (exp.description && exp.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="admin-section" style={{ maxWidth: 960 }}>
      <div className="admin-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2>Work & Leadership Experience</h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Curate professional roles, internships, timeline dates, and technologies
          </span>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={handleOpenAdd} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> Add Experience
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

      {/* Filter / Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Total Positions: <strong>{experience.length}</strong> (Public: {experience.filter(e => e.visibility).length})
        </div>

        <div style={{ position: 'relative', minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="admin-input"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search roles or orgs..."
            style={{ paddingLeft: 30, fontSize: 12, height: 32 }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 32, color: 'var(--text-muted)' }}>
          <Loader2 className="spinning" size={20} />
          <span>Loading experience from server...</span>
        </div>
      ) : experience.length === 0 ? (
        <div className="admin-empty-state">
          <span className="admin-empty-icon">💼</span>
          <p>No experience entries configured yet.</p>
          <p className="admin-hint">Click "Add Experience" to add your first position.</p>
        </div>
      ) : (
        <div className="admin-experience-list" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredExperience.map((exp, idx) => (
            <div
              key={exp.id}
              className={`admin-experience-card ${!exp.visibility ? 'hidden-card' : ''}`}
            >
              <div className="admin-experience-header">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  {/* Reordering Controls */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                    <button
                      className="admin-icon-btn small"
                      title="Move Up"
                      disabled={idx === 0}
                      onClick={() => void handleMove(exp, 'up')}
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      className="admin-icon-btn small"
                      title="Move Down"
                      disabled={idx === filteredExperience.length - 1}
                      onClick={() => void handleMove(exp, 'down')}
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>

                  <div>
                    <h4 style={{ margin: '0 0 4px', fontSize: 15 }}>{exp.role}</h4>
                    <p className="admin-experience-org" style={{ margin: 0, fontWeight: 500, color: 'var(--accent)' }}>
                      {exp.organization}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="admin-experience-meta" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="admin-experience-date" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                      <Calendar size={13} /> {exp.start_date} — {exp.end_date || 'Present'}
                    </span>
                    <span className={`admin-badge ${exp.visibility ? 'public' : 'draft'}`}>
                      {exp.visibility ? 'Public' : 'Hidden'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Order: {exp.sort_order}</span>
                  </div>

                  <div className="admin-experience-actions">
                    <button
                      className="admin-icon-btn"
                      title={exp.visibility ? 'Make Hidden' : 'Make Public'}
                      onClick={() => void handleToggleVisibility(exp)}
                    >
                      {exp.visibility ? <Eye size={15} style={{ color: '#2ecc71' }} /> : <EyeOff size={15} style={{ color: 'var(--text-muted)' }} />}
                    </button>
                    <button className="admin-icon-btn" onClick={() => handleEdit(exp)} title="Edit">
                      <Edit size={15} />
                    </button>
                    <button className="admin-icon-btn admin-icon-btn-danger" onClick={() => void handleDelete(exp)} title="Delete">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="admin-experience-preview" style={{ padding: '12px 16px' }}>
                {exp.description && (
                  <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.5, color: 'var(--text)' }}>
                    {exp.description}
                  </p>
                )}

                {exp.technologies && exp.technologies.length > 0 && (
                  <div className="admin-tech-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: exp.link ? 10 : 0 }}>
                    {exp.technologies.map(t => (
                      <span key={t} className="admin-tech-tag" style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: 4, border: '1px solid var(--border)' }}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {exp.link && (
                  <a
                    href={exp.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="admin-link"
                    style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent)', textDecoration: 'none' }}
                  >
                    <span>Organization Website</span>
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="admin-modal-overlay" onClick={handleCloseModal}>
          <div className="admin-modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>{editingId ? 'Edit Experience Position' : 'Add Experience Position'}</h3>
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
                <div className="admin-form-field">
                  <label>Organization / Company *</label>
                  <input
                    type="text"
                    value={formData.organization}
                    onChange={e => setFormData({ ...formData, organization: e.target.value })}
                    placeholder="e.g. Acme Corp, Research Lab"
                    className="admin-input"
                    autoFocus
                  />
                </div>

                <div className="admin-form-field">
                  <label>Job Title / Role *</label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                    placeholder="e.g. Full Stack Engineer, Security Analyst"
                    className="admin-input"
                  />
                </div>

                <div className="admin-form-field">
                  <label>Start Date * (YYYY-MM)</label>
                  <input
                    type="month"
                    value={formData.start_date}
                    onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                    className="admin-input"
                  />
                </div>

                <div className="admin-form-field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ margin: 0 }}>End Date</label>
                    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--accent)' }}>
                      <input
                        type="checkbox"
                        checked={formData.is_present}
                        onChange={e => {
                          const checked = e.target.checked;
                          setFormData({
                            ...formData,
                            is_present: checked,
                            end_date: checked ? '' : formData.end_date,
                          });
                        }}
                      />
                      <span>Present / Current</span>
                    </label>
                  </div>
                  <input
                    type="month"
                    value={formData.end_date}
                    onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                    disabled={formData.is_present}
                    className="admin-input"
                    placeholder={formData.is_present ? 'Present' : ''}
                  />
                </div>

                <div className="admin-form-field admin-form-field-full" style={{ gridColumn: '1 / -1' }}>
                  <label>Description & Key Achievements</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe responsibilities, projects delivered, architecture built..."
                    className="admin-textarea"
                    rows={4}
                  />
                </div>

                <div className="admin-form-field admin-form-field-full" style={{ gridColumn: '1 / -1' }}>
                  <label>Technologies Used (comma-separated)</label>
                  <input
                    type="text"
                    value={formData.technologies}
                    onChange={e => setFormData({ ...formData, technologies: e.target.value })}
                    placeholder="TypeScript, Node.js, Fastify, Docker, AWS, React"
                    className="admin-input"
                  />
                </div>

                <div className="admin-form-field admin-form-field-full" style={{ gridColumn: '1 / -1' }}>
                  <label>Organization Website Link (optional)</label>
                  <input
                    type="url"
                    value={formData.link}
                    onChange={e => setFormData({ ...formData, link: e.target.value })}
                    placeholder="https://company.org"
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
                disabled={saving || !formData.organization.trim() || !formData.role.trim() || !formData.start_date.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {saving ? <Loader2 size={15} className="spinning" /> : <Save size={15} />}
                <span>{editingId ? 'Save Changes' : 'Create Position'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}