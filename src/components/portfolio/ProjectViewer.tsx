import { useState, useEffect } from 'react';
import { projectsApi, type Project } from '../../lib/api/projects';
import { getApiErrorMessage } from '../../lib/api/client';
import {
  FolderGit2,
  ExternalLink,
  GitBranch,
  Star,
  Clock,
  Code2,
  FolderOpen,
  ArrowLeft,
  Loader2,
  AlertCircle,
  FileCode,
} from 'lucide-react';
import { renderMarkdownSafe, formatRelativeDate, isValidUrl } from '../../lib/portfolioUtils';
import type { DesktopOpenRequest } from '../../types/desktop';
import './Portfolio.css';

interface ProjectViewerProps {
  windowId: string;
  appParams?: Record<string, unknown>;
  onOpenRequest?: (request: DesktopOpenRequest) => void;
  onBack?: () => void;
  project?: Project;
}

export function ProjectViewer({
  windowId: _windowId,
  appParams,
  onOpenRequest,
  onBack,
  project: initialProject,
}: ProjectViewerProps) {
  const [project, setProject] = useState<Project | null>(initialProject || (appParams?.project as Project) || null);
  const [loading, setLoading] = useState<boolean>(!initialProject && !appParams?.project && Boolean(appParams?.projectId));
  const [error, setError] = useState<string | null>(null);

  const projectId = (appParams?.projectId as string) || (appParams?.id as string);

  useEffect(() => {
    if (initialProject) {
      setProject(initialProject);
      return;
    }
    if (appParams?.project) {
      setProject(appParams.project as Project);
      return;
    }
    if (projectId) {
      setLoading(true);
      setError(null);
      projectsApi
        .get(projectId)
        .then((data) => setProject(data))
        .catch((err) => setError(getApiErrorMessage(err)))
        .finally(() => setLoading(false));
    }
  }, [projectId, initialProject, appParams?.project]);

  const handleBrowseInFiles = () => {
    if (!project?.github_repo || !onOpenRequest) return;
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

  const handlePreviewImage = (imageUrl: string) => {
    if (!onOpenRequest) return;
    onOpenRequest({
      type: 'open',
      appId: 'image-viewer',
      title: `${project?.name || 'Project'} Preview`,
      path: imageUrl,
      params: {
        path: imageUrl,
      },
    });
  };

  if (loading) {
    return (
      <div className="portfolio-window">
        <div className="portfolio-state-box">
          <Loader2 size={32} className="spinning" />
          <div className="portfolio-state-title">Loading Project Details...</div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="portfolio-window">
        <div className="portfolio-state-box error">
          <AlertCircle size={36} className="state-icon" />
          <div className="portfolio-state-title">Project Not Found</div>
          <div className="portfolio-state-desc">{error || 'The requested project could not be loaded.'}</div>
          {onBack && (
            <button className="portfolio-btn" onClick={onBack}>
              <ArrowLeft size={14} /> Back to Projects
            </button>
          )}
        </div>
      </div>
    );
  }

  const githubUrl = project.github_url || (project.github_repo ? `https://github.com/${project.github_repo}` : null);
  const liveUrl = project.live_url;
  const stars = typeof project.github_stars === 'number' ? project.github_stars : 0;
  const forks = typeof project.github_forks === 'number' ? project.github_forks : 0;
  const primaryLang = project.github_language;
  const topics = project.github_topics || [];
  const updatedDate = project.github_updated_at;

  return (
    <div className="portfolio-window">
      {/* Header */}
      <div className="project-viewer-header">
        <div className="project-viewer-title-row">
          <div className="project-viewer-title-group">
            {onBack && (
              <button className="portfolio-btn" onClick={onBack} title="Back to Projects list">
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
            )}
            <FolderGit2 size={24} className="portfolio-accent-icon" />
            <h2 className="project-viewer-title">{project.name}</h2>
            {project.featured && (
              <span className="portfolio-badge badge-featured">
                <Star size={11} fill="currentColor" /> Featured
              </span>
            )}
            {primaryLang && (
              <span className="portfolio-badge badge-lang">
                <Code2 size={11} /> {primaryLang}
              </span>
            )}
          </div>

          <div className="project-viewer-actions">
            {project.github_repo && (
              <button
                className="portfolio-btn"
                onClick={handleBrowseInFiles}
                title={`Browse ${project.github_repo} files inside MimiOS`}
              >
                <FolderOpen size={14} />
                <span>Browse Files in MimiOS</span>
              </button>
            )}
            {githubUrl && isValidUrl(githubUrl) && (
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="portfolio-btn"
                title="Open repository on GitHub"
              >
                <ExternalLink size={14} />
                <span>Open on GitHub ↗</span>
              </a>
            )}
            {liveUrl && isValidUrl(liveUrl) && (
              <a
                href={liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="portfolio-btn portfolio-btn-primary"
                title="Open live deployment"
              >
                <ExternalLink size={14} />
                <span>Live Demo ↗</span>
              </a>
            )}
          </div>
        </div>

        <p className="project-viewer-desc">{project.description}</p>

        {/* Tech Stack Chips */}
        {project.technologies && project.technologies.length > 0 && (
          <div className="project-topics-row" style={{ marginTop: '12px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Tech Stack:</span>
            {project.technologies.map((tech) => (
              <span key={tech} className="tech-tag">
                {tech}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="project-viewer-body">
        {/* Featured Image if present */}
        {project.featured_image && (
          <div
            style={{
              maxHeight: '260px',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid var(--border)',
              cursor: 'pointer',
            }}
            onClick={() => handlePreviewImage(project.featured_image!)}
            title="Click to view full image in MimiOS Image Viewer"
          >
            <img
              src={project.featured_image}
              alt={project.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        )}

        {/* GitHub Stats & Activity Card */}
        {(project.github_repo || stars > 0 || forks > 0 || updatedDate) && (
          <div className="project-stats-grid">
            {project.github_repo && (
              <div className="project-stat-card">
                <span className="project-stat-label">Repository</span>
                <span className="project-stat-value" style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                  {project.github_repo}
                </span>
              </div>
            )}
            {primaryLang && (
              <div className="project-stat-card">
                <span className="project-stat-label">Language</span>
                <span className="project-stat-value">{primaryLang}</span>
              </div>
            )}
            <div className="project-stat-card">
              <span className="project-stat-label">Stars</span>
              <span className="project-stat-value">★ {stars}</span>
            </div>
            <div className="project-stat-card">
              <span className="project-stat-label">Forks</span>
              <span className="project-stat-value">⑂ {forks}</span>
            </div>
            {updatedDate && (
              <div className="project-stat-card">
                <span className="project-stat-label">Last Updated</span>
                <span className="project-stat-value" style={{ fontSize: '12px' }}>
                  <Clock size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                  {formatRelativeDate(updatedDate)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* GitHub Topics if present */}
        {topics.length > 0 && (
          <div>
            <div className="project-section-title">
              <GitBranch size={15} /> Topics
            </div>
            <div className="project-topics-row">
              {topics.map((t) => (
                <span key={t} className="tech-tag" style={{ color: 'var(--accent)' }}>
                  #{t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Long Description / Readme / Documentation */}
        {project.long_description ? (
          <div>
            <div className="project-section-title">
              <FileCode size={15} /> Project Documentation
            </div>
            <div
              className="project-markdown-view"
              dangerouslySetInnerHTML={{ __html: renderMarkdownSafe(project.long_description) }}
            />
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic' }}>
            No additional documentation provided for this project.
          </div>
        )}
      </div>
    </div>
  );
}
