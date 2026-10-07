import { useEffect, useState, useMemo } from 'react';
import { projectsApi, type Project, type ProjectInput } from '../../lib/api/projects';
import { githubApi, type GitHubRepoSummary } from '../../lib/api/github';
import { assetsApi, type PortfolioAsset } from '../../lib/api/assets';
import { getApiErrorMessage } from '../../lib/api/client';
import {
  Plus,
  Save,
  Loader2,
  Trash2,
  Edit,
  RefreshCw,
  Star,
  GitBranch,
  Search,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  FolderGit2,
  Check,
  AlertCircle,
  FolderOpen,
} from 'lucide-react';
import { useWindowStore } from '../../stores/useWindowStore';
import { getAppIcon } from '../../lib/icons';
import './AdminProjects.css';
import './AdminPortal.css';

interface ProjectFormData {
  name: string;
  description: string;
  long_description: string;
  technologies: string;
  github_url: string;
  github_repo: string;
  live_url: string;
  featured_image: string;
  visibility: 'public' | 'hidden';
  featured: boolean;
  sort_order: number;
}

const emptyFormData: ProjectFormData = {
  name: '',
  description: '',
  long_description: '',
  technologies: '',
  github_url: '',
  github_repo: '',
  live_url: '',
  featured_image: '',
  visibility: 'public',
  featured: false,
  sort_order: 0,
};

type ViewTab = 'curated' | 'discovered';

export function AdminProjects() {
  const { openWindowWithParams } = useWindowStore();
  const [activeTab, setActiveTab] = useState<ViewTab>('curated');

  // Projects State
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'hidden' | 'featured'>('all');

  // Discovered GitHub Repositories State
  const [discoveredRepos, setDiscoveredRepos] = useState<GitHubRepoSummary[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);

  // Assets (for image picker)
  const [assets, setAssets] = useState<PortfolioAsset[]>([]);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<ProjectFormData>(emptyFormData);
  const [formError, setFormError] = useState<string | null>(null);

  // Syncing State
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ id: string; type: 'success' | 'error'; text: string } | null>(null);

  // Browse Repository in MimiOS File Manager
  const handleBrowseInMimiOS = (project: Project) => {
    if (!project.github_repo) return;
    openWindowWithParams(
      {
        id: `files-remote-${project.id}-${Date.now()}`,
        appId: 'files',
        title: `Files — ${project.name} (${project.github_repo})`,
        icon: getAppIcon('files'),
        x: 100 + Math.random() * 80,
        y: 100 + Math.random() * 80,
        width: 820,
        height: 560,
        isMinimized: false,
        isMaximized: false,
      },
      {
        mode: 'github',
        projectId: project.id,
        repo: project.github_repo,
        projectName: project.name,
        path: '',
      }
    );
  };

  const loadProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await projectsApi.listAdmin();
      setProjects(data);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const loadDiscoveredRepos = async (refresh = false) => {
    setLoadingRepos(true);
    setRepoError(null);
    try {
      const data = await githubApi.listRepos(refresh);
      setDiscoveredRepos(data);
    } catch (err) {
      setRepoError(getApiErrorMessage(err));
    } finally {
      setLoadingRepos(false);
    }
  };

  const loadAssets = async () => {
    try {
      const data = await assetsApi.listAdmin();
      setAssets(data.filter(a => a.category === 'image'));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void loadProjects();
    void loadDiscoveredRepos(false);
    void loadAssets();
  }, []);

  const handleEdit = (project: Project) => {
    setEditingId(project.id);
    setShowAddForm(false);
    setSyncStatusMsg(null);
    setFormError(null);
    setFormData({
      name: project.name,
      description: project.description,
      long_description: project.long_description || '',
      technologies: (project.technologies || []).join(', '),
      github_url: project.github_url || '',
      github_repo: project.github_repo || '',
      live_url: project.live_url || '',
      featured_image: project.featured_image || '',
      visibility: project.visibility,
      featured: project.featured,
      sort_order: project.sort_order,
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setShowAddForm(false);
    setFormData(emptyFormData);
    setFormError(null);
  };

  const buildPayload = (data: ProjectFormData): ProjectInput => ({
    name: data.name.trim(),
    description: data.description.trim(),
    long_description: data.long_description.trim() ? data.long_description.trim() : null,
    technologies: data.technologies.split(',').map(t => t.trim()).filter(Boolean),
    github_url: data.github_url.trim() ? data.github_url.trim() : null,
    github_repo: data.github_repo.trim() ? data.github_repo.trim() : null,
    live_url: data.live_url.trim() ? data.live_url.trim() : null,
    featured_image: data.featured_image.trim() ? data.featured_image.trim() : null,
    visibility: data.visibility,
    featured: data.featured,
    sort_order: Number(data.sort_order) || 0,
  });

  const handleSave = async (projectId: string) => {
    if (!formData.name.trim()) {
      setFormError('Project name is required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = buildPayload(formData);
      const updated = await projectsApi.update(projectId, payload);
      setProjects(prev => prev.map(p => (p.id === projectId ? updated : p)));
      handleCancel();
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.name.trim()) {
      setFormError('Project name is required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = buildPayload(formData);
      const created = await projectsApi.create(payload);
      setProjects(prev => [...prev, created]);
      handleCancel();
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVisibility = async (project: Project) => {
    const nextVisibility = project.visibility === 'public' ? 'hidden' : 'public';
    try {
      const updated = await projectsApi.update(project.id, { visibility: nextVisibility });
      setProjects(prev => prev.map(p => (p.id === project.id ? updated : p)));
    } catch (err) {
      alert(`Failed to update visibility: ${getApiErrorMessage(err)}`);
    }
  };

  const handleToggleFeatured = async (project: Project) => {
    try {
      const updated = await projectsApi.update(project.id, { featured: !project.featured });
      setProjects(prev => prev.map(p => (p.id === project.id ? updated : p)));
    } catch (err) {
      alert(`Failed to update featured flag: ${getApiErrorMessage(err)}`);
    }
  };

  const handleMoveOrder = async (project: Project, direction: 'up' | 'down') => {
    const sorted = [...projects].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const currentIndex = sorted.findIndex(p => p.id === project.id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const targetProject = sorted[targetIndex];
    const currentOrder = project.sort_order ?? currentIndex;
    const targetOrder = targetProject.sort_order ?? targetIndex;

    const newCurrentOrder = currentOrder === targetOrder ? (direction === 'up' ? targetOrder - 1 : targetOrder + 1) : targetOrder;

    try {
      const updated = await projectsApi.update(project.id, { sort_order: newCurrentOrder });
      setProjects(prev => prev.map(p => (p.id === project.id ? updated : p)));
    } catch (err) {
      alert(`Failed to reorder: ${getApiErrorMessage(err)}`);
    }
  };

  const handleSync = async (project: Project) => {
    setSyncingId(project.id);
    setSyncStatusMsg(null);
    try {
      const updated = await projectsApi.syncGitHub(project.id, project.github_repo || undefined);
      setProjects(prev => prev.map(p => (p.id === project.id ? updated : p)));
      setSyncStatusMsg({
        id: project.id,
        type: 'success',
        text: `Successfully synced with GitHub (${updated.github_stars ?? 0} stars, ${updated.github_forks ?? 0} forks)`,
      });
    } catch (err) {
      setSyncStatusMsg({
        id: project.id,
        type: 'error',
        text: getApiErrorMessage(err),
      });
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this curated portfolio project? (Remote GitHub repository will NOT be affected)')) {
      return;
    }
    setError(null);
    try {
      await projectsApi.remove(projectId);
      setProjects(prev => prev.filter(p => p.id !== projectId));
      if (editingId === projectId) handleCancel();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const handleImportRepo = (repo: GitHubRepoSummary) => {
    setActiveTab('curated');
    setEditingId(null);
    setShowAddForm(true);
    setFormData({
      name: repo.name,
      description: repo.description || `Repository for ${repo.name}`,
      long_description: `## About ${repo.name}\n\n${repo.description || ''}`,
      technologies: repo.language ? repo.language : (repo.topics || []).join(', '),
      github_url: repo.html_url,
      github_repo: repo.full_name,
      live_url: '',
      featured_image: '',
      visibility: 'public',
      featured: false,
      sort_order: projects.length + 1,
    });
  };

  // Find linked project for a repository
  const repoLinkedMap = useMemo(() => {
    const map = new Map<string, Project>();
    for (const p of projects) {
      if (p.github_repo) {
        map.set(p.github_repo.toLowerCase(), p);
      }
    }
    return map;
  }, [projects]);

  // Filtered curated projects
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchesSearch =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.technologies && p.technologies.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));

      const matchesVisibility =
        visibilityFilter === 'all' ||
        (visibilityFilter === 'public' && p.visibility === 'public') ||
        (visibilityFilter === 'hidden' && p.visibility === 'hidden') ||
        (visibilityFilter === 'featured' && p.featured);

      return matchesSearch && matchesVisibility;
    });
  }, [projects, searchQuery, visibilityFilter]);

  return (
    <div className="admin-section" style={{ maxWidth: 940 }}>
      {/* Header & Tabs */}
      <div className="admin-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2>Projects Management</h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Curate showcase projects and connect to discovered GitHub repositories
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {activeTab === 'curated' && !showAddForm && !editingId && (
            <button
              className="admin-btn admin-btn-primary"
              onClick={() => { setShowAddForm(true); setEditingId(null); setFormData(emptyFormData); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={15} />
              <span>Add Project</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Tabs */}
      <div className="admin-tabs" style={{ marginBottom: 16 }}>
        <button
          className={`admin-tab ${activeTab === 'curated' ? 'active' : ''}`}
          onClick={() => setActiveTab('curated')}
        >
          Curated Projects ({projects.length})
        </button>
        <button
          className={`admin-tab ${activeTab === 'discovered' ? 'active' : ''}`}
          onClick={() => setActiveTab('discovered')}
        >
          Discovered Repositories ({discoveredRepos.length})
        </button>
      </div>

      {error && <div className="admin-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* DISCOVERED GITHUB REPOSITORIES TAB */}
      {activeTab === 'discovered' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Public repositories automatically discovered for configured account. Import any repository to feature it as a portfolio project.
            </span>
            <button
              className="admin-btn admin-btn-secondary"
              onClick={() => void loadDiscoveredRepos(true)}
              disabled={loadingRepos}
              title="Force refresh from GitHub API"
            >
              <RefreshCw size={13} className={loadingRepos ? 'spinning' : ''} />
              <span>Refresh Repositories</span>
            </button>
          </div>

          {repoError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(231, 76, 60, 0.15)', border: '1px solid rgba(231, 76, 60, 0.3)', borderRadius: 6, color: '#e74c3c', marginBottom: 16 }}>
              <AlertCircle size={16} />
              <span>{repoError}</span>
            </div>
          )}

          {loadingRepos ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 32, color: 'var(--text-muted)' }}>
              <Loader2 className="spinning" size={20} />
              <span>Discovering repositories from GitHub...</span>
            </div>
          ) : discoveredRepos.length === 0 ? (
            <div className="admin-empty-state">
              <GitBranch size={36} style={{ opacity: 0.4, marginBottom: 8 }} />
              <p>No public repositories found for configured account.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {discoveredRepos.map(repo => {
                const linkedProject = repoLinkedMap.get(repo.full_name.toLowerCase());
                return (
                  <div key={repo.id} className="admin-card" style={{ display: 'flex', flexDirection: 'column', padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-h)' }}>
                        {repo.name}
                      </h4>
                      <a href={repo.html_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', opacity: 0.8 }} title="View on GitHub">
                        <ExternalLink size={13} />
                      </a>
                    </div>

                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px', flex: 1, minHeight: 36, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {repo.description || 'No description provided on GitHub.'}
                    </p>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 11, marginBottom: 12 }}>
                      {repo.language && (
                        <span className="admin-tech-tag" style={{ fontSize: 10, padding: '1px 6px' }}>{repo.language}</span>
                      )}
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <Star size={11} style={{ fill: '#f1c40f', color: '#f1c40f' }} /> {repo.stargazers_count}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <GitBranch size={11} /> {repo.forks_count}
                      </span>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {linkedProject ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#2ecc71' }}>
                          <Check size={13} />
                          <span>Linked to <strong>{linkedProject.name}</strong></span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Not in portfolio</span>
                      )}

                      {!linkedProject ? (
                        <button
                          className="admin-btn admin-btn-primary"
                          onClick={() => handleImportRepo(repo)}
                          style={{ padding: '4px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Plus size={12} />
                          <span>Import to Portfolio</span>
                        </button>
                      ) : (
                        <button
                          className="admin-btn admin-btn-secondary"
                          onClick={() => handleBrowseInMimiOS(linkedProject)}
                          style={{ padding: '4px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                          title="Browse remote files in MimiOS"
                        >
                          <FolderOpen size={12} />
                          <span>Browse</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CURATED PROJECTS TAB */}
      {activeTab === 'curated' && (
        <>
          {/* Add / Edit Project Form */}
          {(showAddForm || editingId) && (
            <div className="admin-card admin-add-card" style={{ marginBottom: 20 }}>
              <h3 style={{ marginBottom: 14 }}>{editingId ? 'Edit Portfolio Project' : 'Add New Portfolio Project'}</h3>

              {formError && (
                <div style={{ padding: '8px 12px', background: 'rgba(231, 76, 60, 0.15)', border: '1px solid rgba(231, 76, 60, 0.3)', borderRadius: 6, color: '#e74c3c', fontSize: 12, marginBottom: 14 }}>
                  {formError}
                </div>
              )}

              <div className="admin-form-grid">
                <div className="admin-form-field">
                  <label>Project Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. SecureVault"
                    className="admin-input"
                    required
                  />
                </div>

                <div className="admin-form-field">
                  <label>Short Description *</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief summary for cards"
                    className="admin-input"
                  />
                </div>

                <div className="admin-form-field admin-form-field-full">
                  <label>Long Description (Markdown Documentation)</label>
                  <textarea
                    value={formData.long_description}
                    onChange={e => setFormData({ ...formData, long_description: e.target.value })}
                    placeholder="Comprehensive markdown writeup..."
                    className="admin-textarea"
                    rows={4}
                  />
                </div>

                <div className="admin-form-field admin-form-field-full">
                  <label>Technologies (comma-separated)</label>
                  <input
                    type="text"
                    value={formData.technologies}
                    onChange={e => setFormData({ ...formData, technologies: e.target.value })}
                    placeholder="React, TypeScript, SQLite, Node.js"
                    className="admin-input"
                  />
                </div>

                <div className="admin-form-field">
                  <label>GitHub Repository (owner/repo)</label>
                  <input
                    type="text"
                    value={formData.github_repo}
                    onChange={e => {
                      const val = e.target.value;
                      setFormData({
                        ...formData,
                        github_repo: val,
                        github_url: val && !formData.github_url ? `https://github.com/${val}` : formData.github_url,
                      });
                    }}
                    placeholder="e.g. pratyushrobert/SecureVault"
                    className="admin-input"
                  />
                  {discoveredRepos.length > 0 && (
                    <select
                      onChange={e => {
                        if (e.target.value) {
                          const chosen = discoveredRepos.find(r => r.full_name === e.target.value);
                          if (chosen) {
                            setFormData({
                              ...formData,
                              github_repo: chosen.full_name,
                              github_url: chosen.html_url,
                              technologies: formData.technologies || chosen.language || '',
                            });
                          }
                        }
                      }}
                      className="admin-input"
                      style={{ marginTop: 4, fontSize: 11, opacity: 0.8 }}
                    >
                      <option value="">Or select discovered repository...</option>
                      {discoveredRepos.map(r => (
                        <option key={r.id} value={r.full_name}>{r.full_name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="admin-form-field">
                  <label>GitHub URL</label>
                  <input
                    type="url"
                    value={formData.github_url}
                    onChange={e => setFormData({ ...formData, github_url: e.target.value })}
                    placeholder="https://github.com/..."
                    className="admin-input"
                  />
                </div>

                <div className="admin-form-field">
                  <label>Live Demo URL</label>
                  <input
                    type="url"
                    value={formData.live_url}
                    onChange={e => setFormData({ ...formData, live_url: e.target.value })}
                    placeholder="https://example.com"
                    className="admin-input"
                  />
                </div>

                <div className="admin-form-field">
                  <label>Featured Image URL / Asset</label>
                  <input
                    type="text"
                    value={formData.featured_image}
                    onChange={e => setFormData({ ...formData, featured_image: e.target.value })}
                    placeholder="/uploads/... or https://..."
                    className="admin-input"
                  />
                  {assets.length > 0 && (
                    <select
                      onChange={e => {
                        if (e.target.value) setFormData({ ...formData, featured_image: e.target.value });
                      }}
                      className="admin-input"
                      style={{ marginTop: 4, fontSize: 11, opacity: 0.8 }}
                    >
                      <option value="">Or pick uploaded asset...</option>
                      {assets.map(a => (
                        <option key={a.id} value={a.url}>{a.name} ({a.url})</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="admin-form-field">
                  <label>Visibility</label>
                  <select
                    value={formData.visibility}
                    onChange={e => setFormData({ ...formData, visibility: e.target.value as 'public' | 'hidden' })}
                    className="admin-input"
                  >
                    <option value="public">Public (Visible in Portfolio)</option>
                    <option value="hidden">Hidden (Draft / Unpublished)</option>
                  </select>
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

                <div className="admin-form-field">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.featured}
                      onChange={e => setFormData({ ...formData, featured: e.target.checked })}
                    />
                    <span>Highlight as Featured Project</span>
                  </label>
                </div>

                <div className="admin-form-actions">
                  <button className="admin-btn admin-btn-secondary" onClick={handleCancel}>Cancel</button>
                  <button
                    className="admin-btn admin-btn-primary"
                    onClick={() => (editingId ? handleSave(editingId) : handleAdd())}
                    disabled={saving || !formData.name.trim()}
                  >
                    {saving ? <Loader2 size={16} className="spinning" /> : <Save size={16} />}
                    <span>{editingId ? 'Save Changes' : 'Create Project'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Search & Filter Toolbar */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '7px 10px 7px 32px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              {(['all', 'public', 'hidden', 'featured'] as const).map(tab => (
                <button
                  key={tab}
                  className={`admin-tab ${visibilityFilter === tab ? 'active' : ''}`}
                  onClick={() => setVisibilityFilter(tab)}
                  style={{ textTransform: 'capitalize', fontSize: 11, padding: '5px 10px' }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Projects List */}
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 32, color: 'var(--text-muted)' }}>
              <Loader2 className="spinning" size={20} />
              <span>Loading projects from server...</span>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="admin-empty-state">
              <FolderGit2 size={36} style={{ opacity: 0.4, marginBottom: 8 }} />
              <p>No curated projects found matching criteria.</p>
              <p className="admin-hint">Click "Add Project" or import one from the Discovered Repositories tab.</p>
            </div>
          ) : (
            <div className="admin-project-list">
              {filteredProjects.map((project, idx) => (
                <div key={project.id} className="admin-project-card">
                  <div className="admin-project-header">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h4>{project.name}</h4>
                        <span className={`admin-badge ${project.visibility}`}>{project.visibility}</span>
                        {project.featured && <span className="admin-badge featured">Featured</span>}
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Order: {project.sort_order ?? idx}</span>
                      </div>

                      <p style={{ margin: '4px 0 8px', fontSize: 12, color: 'var(--text-muted)' }}>
                        {project.description}
                      </p>

                      <div className="admin-project-meta">
                        {project.github_repo && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--mono)', fontSize: 11 }}>
                            <GitBranch size={11} /> {project.github_repo}
                          </span>
                        )}

                        {typeof project.github_stars === 'number' && project.github_stars > 0 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <Star size={11} style={{ fill: '#f1c40f', color: '#f1c40f' }} /> {project.github_stars}
                          </span>
                        )}

                        {typeof project.github_forks === 'number' && project.github_forks > 0 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <GitBranch size={11} /> {project.github_forks}
                          </span>
                        )}

                        {project.github_language && (
                          <span className="admin-tech-tag" style={{ fontSize: 10, padding: '1px 6px' }}>{project.github_language}</span>
                        )}

                        {project.github_sync_status === 'synced' && (
                          <span className="admin-badge public" style={{ fontSize: 9 }}>GitHub Synced</span>
                        )}
                        {project.github_sync_status === 'failed' && (
                          <span className="admin-badge hidden" style={{ fontSize: 9 }}>Sync Failed</span>
                        )}
                      </div>
                    </div>

                    {/* Actions Toolbar */}
                    <div className="admin-project-actions" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {/* Reorder Up/Down */}
                      <button
                        className="admin-icon-btn"
                        onClick={() => void handleMoveOrder(project, 'up')}
                        disabled={idx === 0}
                        title="Move Up"
                        style={{ padding: 4 }}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        className="admin-icon-btn"
                        onClick={() => void handleMoveOrder(project, 'down')}
                        disabled={idx === filteredProjects.length - 1}
                        title="Move Down"
                        style={{ padding: 4 }}
                      >
                        <ArrowDown size={14} />
                      </button>

                      {/* Quick Toggle Visibility */}
                      <button
                        className="admin-icon-btn"
                        onClick={() => void handleToggleVisibility(project)}
                        title={project.visibility === 'public' ? 'Make Hidden' : 'Make Public'}
                        style={{ padding: 4 }}
                      >
                        {project.visibility === 'public' ? <Eye size={14} color="#2ecc71" /> : <EyeOff size={14} style={{ opacity: 0.5 }} />}
                      </button>

                      {/* Quick Toggle Featured */}
                      <button
                        className="admin-icon-btn"
                        onClick={() => void handleToggleFeatured(project)}
                        title={project.featured ? 'Remove Featured' : 'Mark as Featured'}
                        style={{ padding: 4 }}
                      >
                        <Star size={14} style={{ fill: project.featured ? '#f1c40f' : 'transparent', color: project.featured ? '#f1c40f' : 'var(--text)' }} />
                      </button>

                      {/* Sync GitHub */}
                      {project.github_repo && (
                        <button
                          className="admin-btn admin-btn-secondary"
                          style={{ fontSize: 11, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={() => void handleSync(project)}
                          disabled={syncingId === project.id}
                          title="Sync metadata from GitHub"
                        >
                          <RefreshCw size={11} className={syncingId === project.id ? 'spinning' : ''} />
                          <span>{syncingId === project.id ? 'Syncing...' : 'Sync'}</span>
                        </button>
                      )}

                      {/* Browse in MimiOS */}
                      {project.github_repo && (
                        <button
                          className="admin-btn admin-btn-secondary"
                          style={{ fontSize: 11, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={() => handleBrowseInMimiOS(project)}
                          title="Browse repository in MimiOS File Manager"
                        >
                          <FolderOpen size={11} />
                          <span>Browse</span>
                        </button>
                      )}

                      {/* Edit */}
                      <button className="admin-icon-btn" onClick={() => handleEdit(project)} title="Edit">
                        <Edit size={14} />
                      </button>

                      {/* Delete */}
                      <button className="admin-icon-btn admin-icon-btn-danger" onClick={() => handleDelete(project.id)} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {syncStatusMsg && syncStatusMsg.id === project.id && (
                    <div
                      style={{
                        margin: '8px 16px',
                        padding: '6px 12px',
                        borderRadius: 4,
                        fontSize: 11,
                        backgroundColor: syncStatusMsg.type === 'success' ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)',
                        color: syncStatusMsg.type === 'success' ? '#2ecc71' : '#e74c3c',
                        border: `1px solid ${syncStatusMsg.type === 'success' ? 'rgba(46, 204, 113, 0.3)' : 'rgba(231, 76, 60, 0.3)'}`,
                      }}
                    >
                      {syncStatusMsg.text}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}