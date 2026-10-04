import { useState } from 'react';
import { useAdminConfig } from '../../lib/admin/useAdminConfig';
import { Plus, Save, Loader2, Trash2, Edit, Calendar } from 'lucide-react';

export function AdminExperience() {
  const { config, updateConfig } = useAdminConfig();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newExp, setNewExp] = useState({
    organization: '',
    role: '',
    startDate: '',
    endDate: '',
    description: '',
    technologies: '',
    link: '',
  });

  const handleEdit = (exp: typeof config.experience[0]) => {
    setEditingId(exp.id);
    setNewExp({
      organization: exp.organization,
      role: exp.role,
      startDate: exp.startDate,
      endDate: exp.endDate || '',
      description: exp.description,
      technologies: exp.technologies.join(', '),
      link: exp.link || '',
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setShowAddForm(false);
    setNewExp({
      organization: '',
      role: '',
      startDate: '',
      endDate: '',
      description: '',
      technologies: '',
      link: '',
    });
  };

  const handleSave = async (expId: string) => {
    if (!newExp.organization.trim() || !newExp.role.trim()) return;

    setSaving(true);
    try {
      const updates = {
        organization: newExp.organization,
        role: newExp.role,
        startDate: newExp.startDate,
        endDate: newExp.endDate || 'present',
        description: newExp.description,
        technologies: newExp.technologies.split(',').map(t => t.trim()).filter(Boolean),
        link: newExp.link,
      };

      updateConfig(prev => ({
        ...prev,
        experience: prev.experience.map(e =>
          e.id === expId ? { ...e, ...updates } : e
        ),
      }));

      handleCancel();
      alert('Experience saved!');
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save experience');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!newExp.organization.trim() || !newExp.role.trim()) return;

    setSaving(true);
    try {
      const newId = `exp-${Date.now()}`;

      const newExpData = {
        id: newId,
        organization: newExp.organization,
        role: newExp.role,
        startDate: newExp.startDate,
        endDate: newExp.endDate || 'present',
        description: newExp.description,
        technologies: newExp.technologies.split(',').map(t => t.trim()).filter(Boolean),
        link: newExp.link,
        order: config.experience.length + 1,
        visibility: true,
      };

      updateConfig(prev => ({
        ...prev,
        experience: [...prev.experience, newExpData],
      }));

      handleCancel();
      alert('Experience added!');
    } catch (err) {
      console.error('Create failed:', err);
      alert('Failed to add experience');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (expId: string) => {
    if (!confirm('Delete this experience entry?')) return;

    updateConfig(prev => ({
      ...prev,
      experience: prev.experience.filter(e => e.id !== expId),
    }));

    alert('Experience deleted');
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>Experience</h2>
        <button
          className="admin-btn admin-btn-primary"
          onClick={() => setShowAddForm(true)}
        >
          <Plus size={16} /> Add Experience
        </button>
      </div>

      {showAddForm && (
        <div className="admin-card admin-form-card">
          <h3>Add Experience</h3>
          <div className="admin-form-grid">
            <div className="admin-form-field">
              <label>Organization *</label>
              <input
                type="text"
                value={newExp.organization}
                onChange={e => setNewExp({ ...newExp, organization: e.target.value })}
                placeholder="Company/Organization Name"
                className="admin-input"
              />
            </div>
            <div className="admin-form-field">
              <label>Role *</label>
              <input
                type="text"
                value={newExp.role}
                onChange={e => setNewExp({ ...newExp, role: e.target.value })}
                placeholder="Your Role/Title"
                className="admin-input"
              />
            </div>
            <div className="admin-form-field">
              <label>Start Date *</label>
              <input
                type="month"
                value={newExp.startDate}
                onChange={e => setNewExp({ ...newExp, startDate: e.target.value })}
                className="admin-input"
              />
            </div>
            <div className="admin-form-field">
              <label>End Date (leave empty for present)</label>
              <input
                type="month"
                value={newExp.endDate}
                onChange={e => setNewExp({ ...newExp, endDate: e.target.value })}
                className="admin-input"
              />
            </div>
            <div className="admin-form-field admin-form-field-full">
              <label>Description</label>
              <textarea
                value={newExp.description}
                onChange={e => setNewExp({ ...newExp, description: e.target.value })}
                placeholder="Key achievements and responsibilities..."
                className="admin-textarea"
                rows={3}
              />
            </div>
            <div className="admin-form-field admin-form-field-full">
              <label>Technologies (comma-separated)</label>
              <input
                type="text"
                value={newExp.technologies}
                onChange={e => setNewExp({ ...newExp, technologies: e.target.value })}
                placeholder="React, Node.js, AWS..."
                className="admin-input"
              />
            </div>
            <div className="admin-form-field">
              <label>Link (optional)</label>
              <input
                type="url"
                value={newExp.link}
                onChange={e => setNewExp({ ...newExp, link: e.target.value })}
                placeholder="https://company.com"
                className="admin-input"
              />
            </div>
            <div className="admin-form-actions">
              <button className="admin-btn admin-btn-secondary" onClick={handleCancel}>Cancel</button>
              <button className="admin-btn admin-btn-primary" onClick={handleAdd} disabled={saving || !newExp.organization.trim() || !newExp.role.trim()}>
                <Save size={16} /> Add Experience
              </button>
            </div>
          </div>
        </div>
      )}

      {config.experience.length === 0 ? (
        <div className="admin-empty-state">
          <span className="admin-empty-icon">💼</span>
          <p>No experience entries yet.</p>
          <p className="admin-hint">Click "Add Experience" to add your first entry.</p>
        </div>
      ) : (
        <div className="admin-experience-list">
          {config.experience
            .filter(e => e.visibility)
            .sort((a, b) => a.order - b.order)
            .map(exp => (
              <div key={exp.id} className="admin-experience-card">
                <div className="admin-experience-header">
                  <div>
                    <h4>{exp.role}</h4>
                    <p className="admin-experience-org">{exp.organization}</p>
                  </div>
                  <div className="admin-experience-meta">
                    <span className="admin-experience-date">
                      <Calendar size={14} /> {exp.startDate} — {exp.endDate || 'Present'}
                    </span>
                  </div>
                  <div className="admin-experience-actions">
                    <button className="admin-icon-btn" onClick={() => handleEdit(exp)} title="Edit">
                      <Edit size={14} />
                    </button>
                    <button className="admin-icon-btn admin-icon-btn-danger" onClick={() => handleDelete(exp.id)} title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {editingId === exp.id && (
                  <div className="admin-edit-form">
                    <div className="admin-form-grid">
                      <div className="admin-form-field">
                        <label>Organization *</label>
                        <input
                          type="text"
                          value={newExp.organization}
                          onChange={e => setNewExp({ ...newExp, organization: e.target.value })}
                          className="admin-input"
                        />
                      </div>
                      <div className="admin-form-field">
                        <label>Role *</label>
                        <input
                          type="text"
                          value={newExp.role}
                          onChange={e => setNewExp({ ...newExp, role: e.target.value })}
                          className="admin-input"
                        />
                      </div>
                      <div className="admin-form-field">
                        <label>Start Date *</label>
                        <input
                          type="month"
                          value={newExp.startDate}
                          onChange={e => setNewExp({ ...newExp, startDate: e.target.value })}
                          className="admin-input"
                        />
                      </div>
                      <div className="admin-form-field">
                        <label>End Date (empty for present)</label>
                        <input
                          type="month"
                          value={newExp.endDate}
                          onChange={e => setNewExp({ ...newExp, endDate: e.target.value })}
                          className="admin-input"
                        />
                      </div>
                      <div className="admin-form-field admin-form-field-full">
                        <label>Description</label>
                        <textarea
                          value={newExp.description}
                          onChange={e => setNewExp({ ...newExp, description: e.target.value })}
                          className="admin-textarea"
                          rows={3}
                        />
                      </div>
                      <div className="admin-form-field admin-form-field-full">
                        <label>Technologies (comma-separated)</label>
                        <input
                          type="text"
                          value={newExp.technologies}
                          onChange={e => setNewExp({ ...newExp, technologies: e.target.value })}
                          className="admin-input"
                        />
                      </div>
                      <div className="admin-form-field">
                        <label>Link (optional)</label>
                        <input
                          type="url"
                          value={newExp.link}
                          onChange={e => setNewExp({ ...newExp, link: e.target.value })}
                          className="admin-input"
                        />
                      </div>
                      <div className="admin-form-actions">
                        <button className="admin-btn admin-btn-secondary" onClick={handleCancel}>Cancel</button>
                        <button className="admin-btn admin-btn-primary" onClick={() => handleSave(exp.id)} disabled={saving}>
                          {saving ? <Loader2 size={16} /> : <Save size={16} />} Save
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="admin-experience-preview">
                  <p>{exp.description}</p>
                  {exp.technologies.length > 0 && (
                    <div className="admin-tech-tags">
                      {exp.technologies.map(t => (
                        <span key={t} className="admin-tech-tag">{t}</span>
                      ))}
                    </div>
                  )}
                  {exp.link && (
                    <a href={exp.link} target="_blank" rel="noopener noreferrer" className="admin-link">
                      Company Website
                    </a>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}