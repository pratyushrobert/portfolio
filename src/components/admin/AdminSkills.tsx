import { useEffect, useState } from 'react';
import { skillsApi, type Skill, type SkillInput } from '../../lib/api/skills';
import { getApiErrorMessage } from '../../lib/api/client';
import {
  Plus,
  Save,
  Trash2,
  Edit,
  Loader2,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import './AdminSkills.css';

const CATEGORIES = [
  'programming',
  'cybersecurity',
  'web',
  'tools',
  'infrastructure',
  'databases',
  'other',
] as const;

type SkillCategory = (typeof CATEGORIES)[number];
type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

interface SkillFormData {
  name: string;
  category: SkillCategory;
  level: SkillLevel;
  sort_order: number;
  visibility: boolean;
}

const emptyFormData: SkillFormData = {
  name: '',
  category: 'programming',
  level: 'intermediate',
  sort_order: 0,
  visibility: true,
};

export function AdminSkills() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<SkillFormData>(emptyFormData);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadSkills = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await skillsApi.listAdmin();
      setSkills(data);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSkills();
  }, []);

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleOpenAdd = () => {
    const defaultCat: SkillCategory = selectedCategory !== 'all' ? (selectedCategory as SkillCategory) : 'programming';
    const nextOrder = skills.filter(s => s.category === defaultCat).length;
    setEditingId(null);
    setFormData({
      ...emptyFormData,
      category: defaultCat,
      sort_order: nextOrder,
    });
    setShowModal(true);
    setError(null);
  };

  const handleEdit = (skill: Skill) => {
    setEditingId(skill.id);
    setFormData({
      name: skill.name,
      category: skill.category as SkillCategory,
      level: (skill.level || 'intermediate') as SkillLevel,
      sort_order: skill.sort_order,
      visibility: skill.visibility,
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

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Skill name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: SkillInput = {
        name: formData.name.trim(),
        category: formData.category,
        level: formData.level,
        sort_order: Number(formData.sort_order) || 0,
        visibility: formData.visibility,
      };

      if (editingId) {
        const updated = await skillsApi.update(editingId, payload);
        setSkills(prev => prev.map(s => (s.id === editingId ? updated : s)));
        showNotification(`Skill "${updated.name}" updated successfully.`);
      } else {
        const created = await skillsApi.create(payload);
        setSkills(prev => [...prev, created]);
        showNotification(`Skill "${created.name}" created successfully.`);
      }
      handleCloseModal();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVisibility = async (skill: Skill) => {
    try {
      const nextVis = !skill.visibility;
      const updated = await skillsApi.update(skill.id, { visibility: nextVis });
      setSkills(prev => prev.map(s => (s.id === skill.id ? updated : s)));
      showNotification(`Skill "${skill.name}" is now ${nextVis ? 'Public' : 'Hidden'}.`);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const handleMove = async (skill: Skill, direction: 'up' | 'down') => {
    // Reorder within the same category
    const catSkills = skills
      .filter(s => s.category === skill.category)
      .sort((a, b) => a.sort_order - b.sort_order);

    const index = catSkills.findIndex(s => s.id === skill.id);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= catSkills.length) return;

    const otherSkill = catSkills[targetIndex];
    const currentOrder = skill.sort_order;
    const targetOrder = otherSkill.sort_order === currentOrder
      ? (direction === 'up' ? currentOrder - 1 : currentOrder + 1)
      : otherSkill.sort_order;

    try {
      const [u1, u2] = await Promise.all([
        skillsApi.update(skill.id, { sort_order: targetOrder }),
        skillsApi.update(otherSkill.id, { sort_order: currentOrder }),
      ]);

      setSkills(prev =>
        prev.map(s => {
          if (s.id === skill.id) return u1;
          if (s.id === otherSkill.id) return u2;
          return s;
        })
      );
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const handleDelete = async (skill: Skill) => {
    if (!window.confirm(`Are you sure you want to delete "${skill.name}"?`)) return;
    setError(null);
    try {
      await skillsApi.remove(skill.id);
      setSkills(prev => prev.filter(s => s.id !== skill.id));
      showNotification(`Deleted skill "${skill.name}".`);
      if (editingId === skill.id) handleCloseModal();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  // Filter skills
  const filteredSkills = skills.filter(skill => {
    const matchesCategory = selectedCategory === 'all' || skill.category === selectedCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categoriesToRender = selectedCategory === 'all'
    ? CATEGORIES
    : CATEGORIES.filter(c => c === selectedCategory);

  return (
    <div className="admin-section" style={{ maxWidth: 960 }}>
      <div className="admin-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2>Technical Skills</h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Manage technical proficiencies, categorized badges, and display priorities
          </span>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={handleOpenAdd} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> Add Skill
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

      {/* Category Pills & Search */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <button
            className={`admin-filter-pill ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            All Categories ({skills.length})
          </button>
          {CATEGORIES.map(cat => {
            const count = skills.filter(s => s.category === cat).length;
            return (
              <button
                key={cat}
                className={`admin-filter-pill ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)} ({count})
              </button>
            );
          })}
        </div>

        <div style={{ position: 'relative', minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="admin-input"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search skills..."
            style={{ paddingLeft: 30, fontSize: 12, height: 32 }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 32, color: 'var(--text-muted)' }}>
          <Loader2 className="spinning" size={20} />
          <span>Loading skills from server...</span>
        </div>
      ) : skills.length === 0 ? (
        <div className="admin-empty-state">
          <span className="admin-empty-icon">🛠️</span>
          <p>No skills configured in database yet.</p>
          <p className="admin-hint">Click "Add Skill" above to register technical skills.</p>
        </div>
      ) : (
        <div className="admin-skills-categories-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {categoriesToRender.map(category => {
            const catSkills = filteredSkills
              .filter(s => s.category === category)
              .sort((a, b) => a.sort_order - b.sort_order);

            if (catSkills.length === 0 && (selectedCategory !== 'all' || searchQuery)) return null;

            return (
              <div key={category} className="admin-skill-category-card">
                <div className="admin-skill-category-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h4 style={{ margin: 0, textTransform: 'capitalize', fontSize: 14 }}>{category}</h4>
                    <span className="admin-skill-count">{catSkills.length}</span>
                  </div>
                  <button
                    className="admin-btn admin-btn-secondary"
                    style={{ fontSize: 11, padding: '4px 8px' }}
                    onClick={() => {
                      setSelectedCategory(category);
                      handleOpenAdd();
                    }}
                  >
                    <Plus size={12} /> Add to {category}
                  </button>
                </div>

                {catSkills.length === 0 ? (
                  <div style={{ padding: '16px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                    No skills in this category yet.
                  </div>
                ) : (
                  <div className="admin-skill-items-list">
                    {catSkills.map((skill, idx) => (
                      <div
                        key={skill.id}
                        className={`admin-skill-item-row ${!skill.visibility ? 'hidden-item' : ''}`}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                          {/* Reordering arrows */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <button
                              className="admin-icon-btn small"
                              title="Move Up"
                              disabled={idx === 0}
                              onClick={() => void handleMove(skill, 'up')}
                            >
                              <ArrowUp size={11} />
                            </button>
                            <button
                              className="admin-icon-btn small"
                              title="Move Down"
                              disabled={idx === catSkills.length - 1}
                              onClick={() => void handleMove(skill, 'down')}
                            >
                              <ArrowDown size={11} />
                            </button>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span className="admin-skill-name" style={{ fontWeight: 600, fontSize: 13 }}>
                              {skill.name}
                            </span>
                            {skill.level && (
                              <span className={`admin-skill-level ${skill.level}`}>
                                {skill.level}
                              </span>
                            )}
                            <span
                              className={`admin-badge ${skill.visibility ? 'public' : 'draft'}`}
                              style={{ fontSize: 10, padding: '1px 6px' }}
                            >
                              {skill.visibility ? 'Public' : 'Hidden'}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              Order: {skill.sort_order}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button
                            className="admin-icon-btn"
                            title={skill.visibility ? 'Make Hidden' : 'Make Public'}
                            onClick={() => void handleToggleVisibility(skill)}
                          >
                            {skill.visibility ? <Eye size={14} style={{ color: '#2ecc71' }} /> : <EyeOff size={14} style={{ color: 'var(--text-muted)' }} />}
                          </button>
                          <button
                            className="admin-icon-btn"
                            title="Edit Skill"
                            onClick={() => handleEdit(skill)}
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            className="admin-icon-btn admin-icon-btn-danger"
                            title="Delete Skill"
                            onClick={() => void handleDelete(skill)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="admin-modal-overlay" onClick={handleCloseModal}>
          <div className="admin-modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>{editingId ? 'Edit Technical Skill' : 'Add Technical Skill'}</h3>
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

              <div className="admin-form-grid" style={{ gridTemplateColumns: '1fr', gap: 12 }}>
                <div className="admin-form-field">
                  <label>Skill Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. TypeScript, React, Docker, Linux, Wireshark"
                    className="admin-input"
                    autoFocus
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="admin-form-field">
                    <label>Category</label>
                    <select
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value as SkillCategory })}
                      className="admin-select"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>
                          {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="admin-form-field">
                    <label>Proficiency Level</label>
                    <select
                      value={formData.level}
                      onChange={e => setFormData({ ...formData, level: e.target.value as SkillLevel })}
                      className="admin-select"
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                      <option value="expert">Expert</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
            </div>

            <div className="admin-modal-footer">
              <button className="admin-btn admin-btn-secondary" onClick={handleCloseModal}>
                Cancel
              </button>
              <button
                className="admin-btn admin-btn-primary"
                onClick={() => void handleSave()}
                disabled={saving || !formData.name.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {saving ? <Loader2 size={15} className="spinning" /> : <Save size={15} />}
                <span>{editingId ? 'Save Changes' : 'Create Skill'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}