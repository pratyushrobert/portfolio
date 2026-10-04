import { useState } from 'react';
import { useAdminConfig } from '../../lib/admin/useAdminConfig';
import { vfs } from '../../lib/vfs';
import { createFileNode, createDirectoryNode } from '../../lib/vfs/nodes';
import { Plus, Save, Loader2, Trash2, Edit } from 'lucide-react';

export function AdminProjects() {
  const { config, updateConfig } = useAdminConfig();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    longDescription: '',
    technologies: '',
    githubUrl: '',
    liveUrl: '',
    featuredImage: '',
  });

  const handleEdit = (project: typeof config.projects[0]) => {
    setEditingId(project.id);
    setNewProject({
      name: project.name,
      description: project.description,
      longDescription: project.longDescription || '',
      technologies: project.technologies.join(', '),
      githubUrl: project.githubUrl || '',
      liveUrl: project.liveUrl || '',
      featuredImage: project.featuredImage || '',
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setShowAddForm(false);
    setNewProject({
      name: '',
      description: '',
      longDescription: '',
      technologies: '',
      githubUrl: '',
      liveUrl: '',
      featuredImage: '',
    });
  };

  const handleSave = async (projectId: string) => {
    setSaving(true);
    try {
      const updates = {
        name: newProject.name,
        description: newProject.description,
        longDescription: newProject.longDescription,
        technologies: newProject.technologies.split(',').map(t => t.trim()).filter(Boolean),
        githubUrl: newProject.githubUrl,
        liveUrl: newProject.liveUrl,
        featuredImage: newProject.featuredImage,
      };

      updateConfig(prev => ({
        ...prev,
        projects: prev.projects.map(p =>
          p.id === projectId ? { ...p, ...updates } : p
        ),
      }));

      // Also update VFS README if it exists
      const projectDir = Object.values(vfs.getState().nodes).find(
        n => n.name === projectId && n.type === 'directory'
      );
      if (projectDir && 'children' in projectDir) {
        const readme = projectDir.children.find(id => {
          const node = vfs.getState().nodes[id];
          return node && node.name === 'README.md';
        });
        if (readme) {
          const readmeContent = `# ${newProject.name}\n\n${newProject.longDescription || newProject.description}\n\n**Tech Stack:** ${newProject.technologies}\n\n**Links:**\n- GitHub: ${newProject.githubUrl || 'N/A'}\n- Live: ${newProject.liveUrl || 'N/A'}`;
          vfs.writeFile(vfs.getNodePath(readme), readmeContent, 'text/markdown');
        }
      }

      handleCancel();
      alert('Project saved!');
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save project');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!newProject.name.trim()) return;

    setSaving(true);
    try {
      const newId = newProject.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

      // Check if ID already exists
      if (config.projects.some(p => p.id === newId)) {
        alert('Project with this name already exists');
        setSaving(false);
        return;
      }

      const newProj = {
        id: newId,
        name: newProject.name,
        description: newProject.description,
        longDescription: newProject.longDescription,
        technologies: newProject.technologies.split(',').map(t => t.trim()).filter(Boolean),
        githubUrl: newProject.githubUrl,
        liveUrl: newProject.liveUrl,
        featuredImage: newProject.featuredImage,
        visibility: 'public' as const,
        order: config.projects.length + 1,
        featured: false,
      };

      updateConfig(prev => ({
        ...prev,
        projects: [...prev.projects, newProj],
      }));

      // Create project directory in VFS
      const projectsDir = Object.values(vfs.getState().nodes).find(
        n => n.name === 'projects' && n.type === 'directory'
      );
      if (projectsDir && 'children' in projectsDir) {
        const projectDir = createDirectoryNode(newId, projectsDir.id);
        vfs.getState().nodes[projectDir.id] = projectDir;
        projectsDir.children.push(projectDir.id);

        // Create README.md
        const readmeContent = `# ${newProject.name}\n\n${newProject.longDescription || newProject.description}\n\n**Tech Stack:** ${newProject.technologies}\n\n**Links:**\n- GitHub: ${newProject.githubUrl || 'N/A'}\n- Live: ${newProject.liveUrl || 'N/A'}`;
        const readme = createFileNode('README.md', projectDir.id, readmeContent, 'text/markdown');
        vfs.getState().nodes[readme.id] = readme;
        projectDir.children.push(readme.id);

        vfs.getState().nodes = { ...vfs.getState().nodes };
      }

      handleCancel();
      alert('Project created!');
    } catch (err) {
      console.error('Create failed:', err);
      alert('Failed to create project');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm('Delete this project? This will also remove its VFS directory.')) return;

    try {
      // Remove from VFS
      const state = vfs.getState();
      const projectDir = Object.values(state.nodes).find(
        n => n.name === projectId && n.type === 'directory'
      );
      if (projectDir && 'children' in projectDir) {
        // Remove all children first
        for (const childId of projectDir.children) {
          delete state.nodes[childId];
        }
        // Remove directory
        if (projectDir.parentId) {
          const parent = state.nodes[projectDir.parentId];
          if (parent && 'children' in parent) {
            parent.children = parent.children.filter(id => id !== projectDir.id);
          }
        }
        delete state.nodes[projectId];
        vfs.notify();
      }

      updateConfig(prev => ({
        ...prev,
        projects: prev.projects.filter(p => p.id !== projectId),
      }));

      alert('Project deleted');
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete project');
    }
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>Projects</h2>
        <button
          className="admin-btn admin-btn-primary"
          onClick={() => setShowAddForm(true)}
        >
          <Plus size={16} /> Add Project
        </button>
      </div>

      {showAddForm && (
        <div className="admin-card admin-form-card">
          <h3>New Project</h3>
          <div className="admin-form-grid">
            <div className="admin-form-field">
              <label>Name *</label>
              <input
                type="text"
                value={newProject.name}
                onChange={e => setNewProject({ ...newProject, name: e.target.value })}
                placeholder="Project Name"
                className="admin-input"
              />
            </div>
            <div className="admin-form-field">
              <label>Short Description *</label>
              <input
                type="text"
                value={newProject.description}
                onChange={e => setNewProject({ ...newProject, description: e.target.value })}
                placeholder="Brief description"
                className="admin-input"
              />
            </div>
            <div className="admin-form-field admin-form-field-full">
              <label>Long Description (Markdown)</label>
              <textarea
                value={newProject.longDescription}
                onChange={e => setNewProject({ ...newProject, longDescription: e.target.value })}
                placeholder="Detailed description..."
                className="admin-textarea"
                rows={4}
              />
            </div>
            <div className="admin-form-field admin-form-field-full">
              <label>Technologies (comma-separated)</label>
              <input
                type="text"
                value={newProject.technologies}
                onChange={e => setNewProject({ ...newProject, technologies: e.target.value })}
                placeholder="React, TypeScript, Node.js..."
                className="admin-input"
              />
            </div>
            <div className="admin-form-field">
              <label>GitHub URL</label>
              <input
                type="url"
                value={newProject.githubUrl}
                onChange={e => setNewProject({ ...newProject, githubUrl: e.target.value })}
                placeholder="https://github.com/..."
                className="admin-input"
              />
            </div>
            <div className="admin-form-field">
              <label>Live Demo URL</label>
              <input
                type="url"
                value={newProject.liveUrl}
                onChange={e => setNewProject({ ...newProject, liveUrl: e.target.value })}
                placeholder="https://example.com"
                className="admin-input"
              />
            </div>
            <div className="admin-form-field">
              <label>Featured Image (assetPath)</label>
              <input
                type="text"
                value={newProject.featuredImage}
                onChange={e => setNewProject({ ...newProject, featuredImage: e.target.value })}
                placeholder="/portfolio/images/project.png"
                className="admin-input"
              />
            </div>
            <div className="admin-form-actions">
              <button className="admin-btn admin-btn-secondary" onClick={handleCancel}>Cancel</button>
              <button className="admin-btn admin-btn-primary" onClick={handleAdd} disabled={saving || !newProject.name.trim()}>
                {saving ? <Loader2 size={16} /> : <Save size={16} />} Add Project
              </button>
            </div>
          </div>
        </div>
      )}

      {config.projects.length === 0 ? (
        <div className="admin-empty-state">
          <span className="admin-empty-icon">🚀</span>
          <p>No projects configured yet.</p>
          <p className="admin-hint">Click "Add Project" to create your first portfolio project.</p>
        </div>
      ) : (
        <div className="admin-project-list">
          {config.projects.map(project => (
            <div key={project.id} className="admin-project-card">
              <div className="admin-project-header">
                <div>
                  <h4>{project.name}</h4>
                  <div className="admin-project-meta">
                    <span className={`admin-badge ${project.visibility}`}>{project.visibility}</span>
                    <span className={project.featured ? 'admin-badge featured' : ''}>Featured</span>
                    <span>Order: {project.order}</span>
                  </div>
                </div>
                <div className="admin-project-actions">
                  <button className="admin-icon-btn" onClick={() => handleEdit(project)} title="Edit">
                    <Edit size={16} />
                  </button>
                  <button className="admin-icon-btn admin-icon-btn-danger" onClick={() => handleDelete(project.id)} title="Delete">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {editingId === project.id && (
                <div className="admin-edit-form">
                  <div className="admin-form-grid">
                    <div className="admin-form-field">
                      <label>Name *</label>
                      <input
                        type="text"
                        value={newProject.name}
                        onChange={e => setNewProject({ ...newProject, name: e.target.value })}
                        className="admin-input"
                      />
                    </div>
                    <div className="admin-form-field">
                      <label>Short Description *</label>
                      <input
                        type="text"
                        value={newProject.description}
                        onChange={e => setNewProject({ ...newProject, description: e.target.value })}
                        className="admin-input"
                      />
                    </div>
                    <div className="admin-form-field admin-form-field-full">
                      <label>Long Description (Markdown)</label>
                      <textarea
                        value={newProject.longDescription}
                        onChange={e => setNewProject({ ...newProject, longDescription: e.target.value })}
                        className="admin-textarea"
                        rows={3}
                      />
                    </div>
                    <div className="admin-form-field admin-form-field-full">
                      <label>Technologies (comma-separated)</label>
                      <input
                        type="text"
                        value={newProject.technologies}
                        onChange={e => setNewProject({ ...newProject, technologies: e.target.value })}
                        className="admin-input"
                      />
                    </div>
                    <div className="admin-form-field">
                      <label>GitHub URL</label>
                      <input
                        type="url"
                        value={newProject.githubUrl}
                        onChange={e => setNewProject({ ...newProject, githubUrl: e.target.value })}
                        className="admin-input"
                      />
                    </div>
                    <div className="admin-form-field">
                      <label>Live URL</label>
                      <input
                        type="url"
                        value={newProject.liveUrl}
                        onChange={e => setNewProject({ ...newProject, liveUrl: e.target.value })}
                        className="admin-input"
                      />
                    </div>
                    <div className="admin-form-field">
                      <label>Featured Image (assetPath)</label>
                      <input
                        type="text"
                        value={newProject.featuredImage}
                        onChange={e => setNewProject({ ...newProject, featuredImage: e.target.value })}
                        className="admin-input"
                      />
                    </div>
                    <div className="admin-form-actions">
                      <button className="admin-btn admin-btn-secondary" onClick={handleCancel}>Cancel</button>
                      <button className="admin-btn admin-btn-primary" onClick={() => handleSave(project.id)} disabled={saving}>
                        {saving ? <Loader2 size={16} /> : <Save size={16} />} Save
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="admin-project-preview">
                <p>{project.description}</p>
                {project.technologies.length > 0 && (
                  <div className="admin-tech-tags">
                    {project.technologies.map(t => (
                      <span key={t} className="admin-tech-tag">{t}</span>
                    ))}
                  </div>
                )}
                <div className="admin-project-links">
                  {project.githubUrl && (
                    <a href={project.githubUrl} target="_blank" rel="noopener noreferrer" className="admin-link">
                      GitHub
                    </a>
                  )}
                  {project.liveUrl && (
                    <a href={project.liveUrl} target="_blank" rel="noopener noreferrer" className="admin-link">
                      Live Demo
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}