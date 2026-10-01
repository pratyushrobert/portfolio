import React, { useEffect, useState } from 'react';
import { Github, ExternalLink, Code, FolderOpen, Star, Eye } from 'lucide-react';
import { vfs } from '../../../lib/vfs';
import type { AnyVFSNode } from '../../../types/vfs';
import { useWindowStore } from '../../../hooks/useWindows';
import markdownIt from 'markdown-it';
import './ProjectsApp.css';

interface ProjectsAppProps {
  instance: any;
}

const md = markdownIt({ html: true, breaks: true, linkify: true });

interface Project {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  techStack: string[];
  githubUrl?: string;
  demoUrl?: string;
  imageUrl?: string;
  featured: boolean;
}

export const ProjectsApp: React.FC<ProjectsAppProps> = ({ instance }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const { openWindow } = useWindowStore();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const result = vfs.list('/home/user/projects');
      if (result.success) {
        const projectDirs = result.data!.filter((n) => n.type === 'directory');
        const loadedProjects: Project[] = [];

        for (const dir of projectDirs) {
          const readmeResult = vfs.readFile(`/home/user/projects/${dir.name}/README.md`);
          if (readmeResult.success) {
            const content = readmeResult.data!;
            const project = parseProjectReadme(dir.name, content);
            loadedProjects.push(project);
          }
        }

        // Add default projects if none found
        if (loadedProjects.length === 0) {
          loadedProjects.push(...getDefaultProjects());
        }

        setProjects(loadedProjects);
      } else {
        setProjects(getDefaultProjects());
      }
    } catch {
      setProjects(getDefaultProjects());
    } finally {
      setLoading(false);
    }
  };

  const parseProjectReadme = (name: string, content: string): Project => {
    // Simple parsing - extract first heading as name, first paragraph as description
    const lines = content.split('\n');
    let title = name;
    let description = '';
    let longDescription = content;
    const techStack: string[] = [];
    let githubUrl = '';
    let demoUrl = '';

    for (const line of lines) {
      if (line.startsWith('# ')) title = line.substring(2).trim();
      else if (!description && line.trim() && !line.startsWith('#')) {
        description = line.trim().substring(0, 150);
      }
      // Look for tech stack
      if (line.toLowerCase().includes('tech') || line.toLowerCase().includes('stack')) {
        const nextIdx = lines.indexOf(line) + 1;
        if (nextIdx < lines.length) {
          const techLine = lines[nextIdx];
          techStack.push(...techLine.split(',').map((t) => t.trim()).filter(Boolean));
        }
      }
      // Look for URLs
      if (line.includes('github.com')) {
        const match = line.match(/https?:\/\/github\.com\/[\w\-\/]+/);
        if (match) githubUrl = match[0];
      }
      if (line.includes('demo') || line.includes('live') || line.includes('https://')) {
        const match = line.match(/https?:\/\/[\w\-\.\/]+/);
        if (match && match[0] !== githubUrl) demoUrl = match[0];
      }
    }

    return {
      id: name,
      name: title,
      description: description || 'No description available',
      longDescription,
      techStack: techStack.length > 0 ? techStack : ['React', 'TypeScript'],
      githubUrl,
      demoUrl,
      featured: true,
    };
  };

  const getDefaultProjects = (): Project[] => [
    {
      id: 'portfolio-os',
      name: 'PratyushOS',
      description: 'A browser-based Linux-style portfolio operating system with terminal, file manager, and virtual filesystem.',
      longDescription: `# PratyushOS

A fully functional browser-based Linux-style portfolio operating system.

## Features
- **Window Management**: Draggable, resizable, minimizable, maximizable windows
- **Terminal**: Full xterm.js implementation with virtual filesystem commands
- **File Manager**: Grid and list views, navigation, file operations
- **Virtual Filesystem**: Persistent localStorage-backed filesystem
- **Media Viewers**: Image viewer, video player, PDF viewer
- **Admin Panel**: Content management for portfolio data
- **Easter Eggs**: Hidden features and surprises

## Tech Stack
React, TypeScript, Vite, Zustand, xterm.js, pdfjs-dist, markdown-it

## Commands Implemented
ls, cd, pwd, cat, mkdir, touch, rm, cp, mv, find, tree, help, clear, history, whoami, date, echo, man`,
      techStack: ['React', 'TypeScript', 'Vite', 'Zustand', 'xterm.js'],
      githubUrl: 'https://github.com/pratyush/portfolio-os',
      demoUrl: 'https://pratyushos.dev',
      featured: true,
    },
    {
      id: 'task-manager',
      name: 'TaskFlow',
      description: 'Real-time collaborative task management app with drag-and-drop boards.',
      longDescription: `# TaskFlow

A modern task management application with real-time collaboration.

## Features
- **Kanban Boards**: Drag-and-drop task management
- **Real-time Updates**: Socket.io powered live collaboration
- **Teams & Workspaces**: Organize projects by team
- **Notifications**: In-app and email notifications
- **Dark Mode**: Full theme support

## Tech Stack
React, Node.js, Express, Socket.io, PostgreSQL, Prisma, Tailwind CSS`,
      techStack: ['React', 'Node.js', 'Socket.io', 'PostgreSQL', 'Tailwind'],
      githubUrl: 'https://github.com/pratyush/taskflow',
      demoUrl: 'https://taskflow.dev',
      featured: true,
    },
    {
      id: 'code-editor',
      name: 'CodeSandbox Clone',
      description: 'In-browser IDE with live preview, file system, and terminal.',
      longDescription: `# CodeSandbox Clone

A browser-based development environment inspired by CodeSandbox.

## Features
- **Monaco Editor**: Full VS Code editor experience
- **WebContainers**: Node.js in the browser
- **Live Preview**: Hot module replacement
- **File System**: Virtual filesystem with persistence
- **Terminal**: Integrated xterm.js terminal

## Tech Stack
React, TypeScript, Monaco Editor, WebContainers API, Vite`,
      techStack: ['React', 'TypeScript', 'Monaco', 'WebContainers'],
      githubUrl: 'https://github.com/pratyush/codesandbox-clone',
      featured: true,
    },
  ];

  const openProjectDetail = (project: Project) => {
    setSelectedProject(project);
  };

  const closeProjectDetail = () => {
    setSelectedProject(null);
  };

  const openFileManager = (path: string) => {
    openWindow('file-manager');
    // Could navigate to path
  };

  if (loading) {
    return (
      <div className="projects-app loading">
        <div className="projects-spinner" />
      </div>
    );
  }

  return (
    <div className="projects-app" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="projects-header">
        <h1>Projects</h1>
        <p className="projects-subtitle">{projects.length} projects • Click to explore</p>
      </div>

      {/* Project Grid */}
      <div className="projects-grid" style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        {projects.map((project) => (
          <article
            key={project.id}
            className="project-card"
            onClick={() => openProjectDetail(project)}
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && openProjectDetail(project)}
          >
            <div className="project-card-header">
              <div className="project-card-icon">
                <FolderOpen className="lucide-icon" size={24} />
              </div>
              {project.featured && <Star className="project-featured" size={16} />}
            </div>
            <h3 className="project-card-title">{project.name}</h3>
            <p className="project-card-description">{project.description}</p>
            <div className="project-card-tech">
              {project.techStack.slice(0, 4).map((tech) => (
                <span key={tech} className="tech-tag">{tech}</span>
              ))}
              {project.techStack.length > 4 && (
                <span className="tech-tag more">+{project.techStack.length - 4}</span>
              )}
            </div>
            <div className="project-card-links">
              {project.githubUrl && (
                <a
                  href={project.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="project-link"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Github size={16} />
                  <span>Code</span>
                </a>
              )}
              {project.demoUrl && (
                <a
                  href={project.demoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="project-link"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink size={16} />
                  <span>Demo</span>
                </a>
              )}
              <button
                className="project-link"
                onClick={(e) => { e.stopPropagation(); openFileManager(`/home/user/projects/${project.id}`); }}
              >
                <Code size={16} />
                <span>Files</span>
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* Project Detail Modal */}
      {selectedProject && (
        <div className="project-modal-overlay" onClick={closeProjectDetail}>
          <div className="project-modal" onClick={(e) => e.stopPropagation()}>
            <button className="project-modal-close" onClick={closeProjectDetail}>
              <Eye size={20} />
            </button>

            <div className="project-modal-header">
              <div className="project-modal-icon">
                <FolderOpen className="lucide-icon" size={32} />
              </div>
              <div>
                <h2>{selectedProject.name}</h2>
                {selectedProject.featured && <Star className="project-featured" size={16} />}
              </div>
            </div>

            <div className="project-modal-body">
              <div className="project-modal-description" dangerouslySetInnerHTML={{ __html: md.render(selectedProject.longDescription) }} />

              <div className="project-modal-tech">
                <h4>Tech Stack</h4>
                <div className="tech-tags">
                  {selectedProject.techStack.map((tech) => (
                    <span key={tech} className="tech-tag">{tech}</span>
                  ))}
                </div>
              </div>

              <div className="project-modal-links">
                {selectedProject.githubUrl && (
                  <a href={selectedProject.githubUrl} target="_blank" rel="noopener noreferrer" className="project-modal-link">
                    <Github size={18} />
                    <span>View Source</span>
                  </a>
                )}
                {selectedProject.demoUrl && (
                  <a href={selectedProject.demoUrl} target="_blank" rel="noopener noreferrer" className="project-modal-link">
                    <ExternalLink size={18} />
                    <span>Live Demo</span>
                  </a>
                )}
                <button className="project-modal-link" onClick={() => { closeProjectDetail(); openFileManager(`/home/user/projects/${selectedProject.id}`); }}>
                  <Code size={18} />
                  <span>Browse Files</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};