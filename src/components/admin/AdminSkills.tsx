import { useState } from 'react';
import { useAdminConfig } from '../../lib/admin/useAdminConfig';
import { Plus, Save, Loader2, Trash2, Edit } from 'lucide-react';

const CATEGORIES = [
  'programming',
  'cybersecurity',
  'web',
  'tools',
  'infrastructure',
  'databases',
  'other',
] as const;

export function AdminSkills() {
  const { config, updateConfig } = useAdminConfig();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newSkill, setNewSkill] = useState({
    name: '',
    category: 'programming' as typeof CATEGORIES[number],
    level: 'intermediate' as 'beginner' | 'intermediate' | 'advanced' | 'expert',
  });

  const handleEdit = (skill: typeof config.skills[0]) => {
    setEditingId(skill.id);
    setNewSkill({
      name: skill.name,
      category: skill.category,
      level: skill.level || 'intermediate',
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setShowAddForm(false);
    setNewSkill({
      name: '',
      category: 'programming',
      level: 'intermediate',
    });
  };

  const handleSave = async (skillId: string) => {
    if (!newSkill.name.trim()) return;

    setSaving(true);
    try {
      const updates = {
        name: newSkill.name,
        category: newSkill.category,
        level: newSkill.level,
      };

      updateConfig(prev => ({
        ...prev,
        skills: prev.skills.map(s =>
          s.id === skillId ? { ...s, ...updates } : s
        ),
      }));

      handleCancel();
      alert('Skill saved!');
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save skill');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!newSkill.name.trim()) return;

    setSaving(true);
    try {
      const newId = newSkill.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

      if (config.skills.some(s => s.id === newId)) {
        alert('Skill with this name already exists');
        setSaving(false);
        return;
      }

      const newSkillData = {
        id: newId,
        name: newSkill.name,
        category: newSkill.category,
        level: newSkill.level,
        order: config.skills.length + 1,
        visibility: true,
      };

      updateConfig(prev => ({
        ...prev,
        skills: [...prev.skills, newSkillData],
      }));

      handleCancel();
      alert('Skill added!');
    } catch (err) {
      console.error('Create failed:', err);
      alert('Failed to add skill');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (skillId: string) => {
    if (!confirm('Delete this skill?')) return;

    updateConfig(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s.id !== skillId),
    }));

    alert('Skill deleted');
  };

  const categoryOrder = CATEGORIES;

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>Skills</h2>
        <button
          className="admin-btn admin-btn-primary"
          onClick={() => setShowAddForm(true)}
        >
          <Plus size={16} /> Add Skill
        </button>
      </div>

      {showAddForm && (
        <div className="admin-card admin-form-card">
          <h3>Add Skill</h3>
          <div className="admin-form-grid">
            <div className="admin-form-field">
              <label>Name *</label>
              <input
                type="text"
                value={newSkill.name}
                onChange={e => setNewSkill({ ...newSkill, name: e.target.value })}
                placeholder="e.g., TypeScript, Docker, AWS"
                className="admin-input"
              />
            </div>
            <div className="admin-form-field">
              <label>Category</label>
              <select
                value={newSkill.category}
                onChange={e => setNewSkill({ ...newSkill, category: e.target.value as any })}
                className="admin-select"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="admin-form-field">
              <label>Level</label>
              <select
                value={newSkill.level}
                onChange={e => setNewSkill({ ...newSkill, level: e.target.value as any })}
                className="admin-select"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
              </select>
            </div>
            <div className="admin-form-actions">
              <button className="admin-btn admin-btn-secondary" onClick={handleCancel}>Cancel</button>
              <button className="admin-btn admin-btn-primary" onClick={handleAdd} disabled={saving || !newSkill.name.trim()}>
                <Save size={16} /> Add Skill
              </button>
            </div>
          </div>
        </div>
      )}

      {config.skills.length === 0 ? (
        <div className="admin-empty-state">
          <span className="admin-empty-icon">🛠️</span>
          <p>No skills configured yet.</p>
          <p className="admin-hint">Click "Add Skill" to add your first skill.</p>
        </div>
      ) : (
        <div className="admin-skills-grid">
          {categoryOrder.map(category => {
            const categorySkills = config.skills
              .filter(s => s.category === category && s.visibility)
              .sort((a, b) => a.order - b.order);

            if (categorySkills.length === 0) return null;

            return (
              <div key={category} className="admin-skill-category">
                <h4 className="admin-skill-category-title">
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                  <span className="admin-skill-count">{categorySkills.length}</span>
                </h4>
                <div className="admin-skill-list">
                  {categorySkills.map(skill => (
                    <div key={skill.id} className="admin-skill-item">
                      <div className="admin-skill-info">
                        <span className="admin-skill-name">{skill.name}</span>
                        <span className={`admin-skill-level ${skill.level}`}>{skill.level}</span>
                      </div>
                      <div className="admin-skill-actions">
                        <button className="admin-icon-btn" onClick={() => handleEdit(skill)} title="Edit">
                          <Edit size={14} />
                        </button>
                        <button className="admin-icon-btn admin-icon-btn-danger" onClick={() => handleDelete(skill.id)} title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}