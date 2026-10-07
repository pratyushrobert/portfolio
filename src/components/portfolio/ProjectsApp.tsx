import { useState, useEffect, useMemo, useCallback } from 'react';
import { projectsApi, type Project } from '../../lib/api/projects';
import { getApiErrorMessage } from '../../lib/api/client';
import {
  FolderGit2,
  Search,
  RefreshCw,
  Star,
  ExternalLink,
  FolderOpen,
  Code2,
  Clock,
  Loader2,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { ProjectViewer } from './ProjectViewer';
import { formatRelativeDate, isValidUrl } from '../../lib/portfolioUtils';
import type { DesktopOpenRequest } from '../../types/desktop';
import './Portfolio.css';

interface ProjectsAppProps {
  windowId: string;
  onOpenRequest?: (request: DesktopOpenRequest) => void;
}

export function ProjectsApp({ windowId, onOpenRequest }: ProjectsAppProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTech, setSelectedTech] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await projectsApi.list();
      setProjects(data);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  // Extract all unique technologies from projects
  const allTechnologies = useMemo(() => {
    const set = new Set<string>();
    for (const p of projects) {
      if (Array.isArray(p.technologies)) {
        for (const t of p.technologies) {
          if (t) set.add(t);
        }
      }
    }
    return Array.from(set).sort();
  }, [projects]);

  // Filter projects by search query and tech filter
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.technologies && p.technologies.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));

      const matchesTech = !selectedTech || (p.technologies && p.technologies.includes(selectedTech));

      return matchesSearch && matchesTech;
    });
  }, [projects, searchQuery, selectedTech]);

  const handleOpenProjectViewer = (project: Project) => {
    setActiveProject(project);
  };

  const handleBrowseInFiles = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!project.github_repo || !onOpenRequest) return;
    onOpenRequest({
      type: 'open',
      appId: 'files',
      title: `Files — ${project.name} (${project.github_repo})`,
      params: {
        mode: 'github',
        projectId: project.id,
        repo: project.github_repo,
        projectName: project.name,
        path: '',
      },
    });
  };

  // If viewing a single project detail inside this window
  if (activeProject) {
    return (
      <ProjectViewer
        windowId={windowId}
        project={activeProject}
        onBack={() => setActiveProject(null)}
        onOpenRequest={onOpenRequest}
      />
    );
  }

  return (
    <div className="portfolio-window">
      {/* Toolbar */}
      <div className="portfolio-toolbar">
        <div className="portfolio-toolbar-group">
          <div className="portfolio-search-input">
            <Search size={14} style={{ opacity: 0.6 }} />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {selectedTech && (
            <button className="portfolio-btn" onClick={() => setSelectedTech(null)} title="Clear technology filter">
              Tech: {selectedTech} &times;
            </button>
          )}
        </div>

        <div className="portfolio-toolbar-group">
          <button
            className="portfolio-btn"
            onClick={() => void fetchProjects()}
            disabled={loading}
            title="Refresh projects from database"
          >
            <RefreshCw size={13} className={loading ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Tech Filter Quick Bar */}
      {allTechnologies.length > 0 && (
        <div
          style={{
            padding: '6px 14px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--code-bg)',
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Filter:</span>
          <button
            className={`tech-tag ${!selectedTech ? 'selected' : ''}`}
            onClick={() => setSelectedTech(null)}
            style={{
              cursor: 'pointer',
              background: !selectedTech ? 'var(--accent)' : undefined,
              color: !selectedTech ? '#fff' : undefined,
            }}
          >
            All
          </button>
          {allTechnologies.map((tech) => (
            <button
              key={tech}
              className="tech-tag"
              onClick={() => setSelectedTech(selectedTech === tech ? null : tech)}
              style={{
                cursor: 'pointer',
                background: selectedTech === tech ? 'var(--accent)' : undefined,
                color: selectedTech === tech ? '#fff' : undefined,
              }}
            >
              {tech}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="portfolio-content">
        {loading ? (
          <div className="portfolio-state-box">
            <Loader2 size={32} className="spinning" />
            <div className="portfolio-state-title">Loading Projects...</div>
          </div>
        ) : error ? (
          <div className="portfolio-state-box error">
            <AlertCircle size={36} className="state-icon" />
            <div className="portfolio-state-title">Unable to Load Projects</div>
            <div className="portfolio-state-desc">{error}</div>
            <button className="portfolio-btn" onClick={() => void fetchProjects()}>
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="portfolio-state-box">
            <FolderGit2 size={40} className="state-icon" />
            <div className="portfolio-state-title">
              {searchQuery || selectedTech ? 'No Matching Projects' : 'No Projects Published Yet'}
            </div>
            <div className="portfolio-state-desc">
              {searchQuery || selectedTech
                ? 'Try adjusting your search criteria or clear active filters.'
                : 'Projects created in Admin Portal will appear here.'}
            </div>
          </div>
        ) : (
          <div className="projects-grid">
            {filteredProjects.map((p) => {
              const stars = typeof p.github_stars === 'number' ? p.github_stars : 0;
              const forks = typeof p.github_forks === 'number' ? p.github_forks : 0;
              const githubUrl = p.github_url || (p.github_repo ? `https://github.com/${p.github_repo}` : null);

              return (
                <div key={p.id} className="project-card" onClick={() => handleOpenProjectViewer(p)}>
                  <div className="project-card-header">
                    <div className="project-card-title-group">
                      <FolderGit2 size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                      <h3 className="project-card-title">{p.name}</h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {p.featured && (
                        <span className="portfolio-badge badge-featured">
                          <Star size={11} fill="currentColor" /> Featured
                        </span>
                      )}
                      {p.github_language && (
                        <span className="portfolio-badge badge-lang">
                          <Code2 size={11} /> {p.github_language}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="project-card-desc">{p.description}</p>

                  {p.technologies && p.technologies.length > 0 && (
                    <div className="project-card-tech">
                      {p.technologies.slice(0, 4).map((tech) => (
                        <span key={tech} className="tech-tag">
                          {tech}
                        </span>
                      ))}
                      {p.technologies.length > 4 && (
                        <span className="tech-tag" style={{ opacity: 0.7 }}>
                          +{p.technologies.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="project-card-footer">
                    <div className="project-card-meta">
                      {(stars > 0 || forks > 0) && (
                        <>
                          {stars > 0 && <span>★ {stars}</span>}
                          {forks > 0 && <span>⑂ {forks}</span>}
                        </>
                      )}
                      {p.github_updated_at && (
                        <span title={`Updated ${p.github_updated_at}`}>
                          <Clock size={11} /> {formatRelativeDate(p.github_updated_at)}
                        </span>
                      )}
                    </div>

                    <div className="project-card-actions">
                      {p.github_repo && (
                        <button
                          className="portfolio-btn"
                          onClick={(e) => handleBrowseInFiles(p, e)}
                          title="Browse repository in MimiOS File Manager"
                          style={{ padding: '3px 8px', fontSize: '11px' }}
                        >
                          <FolderOpen size={12} />
                          <span>Files</span>
                        </button>
                      )}
                      {githubUrl && isValidUrl(githubUrl) && (
                        <a
                          href={githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="portfolio-btn"
                          onClick={(e) => e.stopPropagation()}
                          title="Open on GitHub"
                          style={{ padding: '3px 8px', fontSize: '11px' }}
                        >
                          <ExternalLink size={12} />
                          <span>GitHub</span>
                        </a>
                      )}
                      {p.live_url && isValidUrl(p.live_url) && (
                        <a
                          href={p.live_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="portfolio-btn portfolio-btn-primary"
                          onClick={(e) => e.stopPropagation()}
                          title="Live Demo"
                          style={{ padding: '3px 8px', fontSize: '11px' }}
                        >
                          <ExternalLink size={12} />
                          <span>Demo</span>
                        </a>
                      )}
                      <button
                        className="portfolio-btn"
                        onClick={() => handleOpenProjectViewer(p)}
                        title="View details"
                        style={{ padding: '3px 8px', fontSize: '11px' }}
                      >
                        <Eye size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
