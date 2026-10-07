import { useState, useEffect, useCallback } from 'react';
import { experienceApi, type Experience } from '../../lib/api/experience';
import { getApiErrorMessage } from '../../lib/api/client';
import {
  Briefcase,
  ExternalLink,
  Calendar,
  RefreshCw,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { isValidUrl } from '../../lib/portfolioUtils';
import './Portfolio.css';

interface ExperienceAppProps {
  windowId: string;
}

export function ExperienceApp({ windowId: _windowId }: ExperienceAppProps) {
  const [experience, setExperience] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExperience = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await experienceApi.list();
      // Sort by sort_order ASC, then by start_date DESC
      const sorted = [...data].sort((a, b) => {
        if ((a.sort_order ?? 0) !== (b.sort_order ?? 0)) {
          return (a.sort_order ?? 0) - (b.sort_order ?? 0);
        }
        return (b.start_date || '').localeCompare(a.start_date || '');
      });
      setExperience(sorted);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchExperience();
  }, [fetchExperience]);

  return (
    <div className="portfolio-window">
      {/* Toolbar */}
      <div className="portfolio-toolbar">
        <div className="portfolio-toolbar-group">
          <Briefcase size={16} className="portfolio-accent-icon" />
          <span style={{ fontWeight: 600, color: 'var(--text-h)' }}>Work & Experience Timeline</span>
          {experience.length > 0 && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
              ({experience.length} {experience.length === 1 ? 'position' : 'positions'})
            </span>
          )}
        </div>

        <div className="portfolio-toolbar-group">
          <button
            className="portfolio-btn"
            onClick={() => void fetchExperience()}
            disabled={loading}
            title="Refresh experience from database"
          >
            <RefreshCw size={13} className={loading ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="portfolio-content">
        {loading ? (
          <div className="portfolio-state-box">
            <Loader2 size={32} className="spinning" />
            <div className="portfolio-state-title">Loading Experience...</div>
          </div>
        ) : error ? (
          <div className="portfolio-state-box error">
            <AlertCircle size={36} className="state-icon" />
            <div className="portfolio-state-title">Unable to Load Experience</div>
            <div className="portfolio-state-desc">{error}</div>
            <button className="portfolio-btn" onClick={() => void fetchExperience()}>
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        ) : experience.length === 0 ? (
          <div className="portfolio-state-box">
            <Briefcase size={40} className="state-icon" />
            <div className="portfolio-state-title">No Experience Entries Published Yet</div>
            <div className="portfolio-state-desc">
              Experience records created in the Admin Portal will appear here.
            </div>
          </div>
        ) : (
          <div className="experience-timeline">
            {experience.map((exp) => {
              const dateRange = exp.end_date
                ? `${exp.start_date} — ${exp.end_date}`
                : `${exp.start_date} — Present`;

              return (
                <div key={exp.id} className="experience-card">
                  <div className="experience-card-header">
                    <div className="experience-role-group">
                      <div className="experience-role">{exp.role}</div>
                      <div>
                        {exp.link && isValidUrl(exp.link) ? (
                          <a
                            href={exp.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="experience-org"
                            title={`Visit ${exp.organization}`}
                          >
                            <span>{exp.organization}</span>
                            <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span className="experience-org" style={{ cursor: 'default' }}>
                            {exp.organization}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="experience-dates">
                      <Calendar size={12} />
                      <span>{dateRange}</span>
                    </div>
                  </div>

                  {exp.description && <div className="experience-description">{exp.description}</div>}

                  {exp.technologies && exp.technologies.length > 0 && (
                    <div className="experience-tech-row">
                      {exp.technologies.map((t) => (
                        <span key={t} className="tech-tag">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
