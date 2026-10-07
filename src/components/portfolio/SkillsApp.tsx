import { useState, useEffect, useMemo, useCallback } from 'react';
import { skillsApi, type Skill } from '../../lib/api/skills';
import { getApiErrorMessage } from '../../lib/api/client';
import {
  Cpu,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  Code2,
  Shield,
  Globe,
  Wrench,
  Server,
  Database,
  Layers,
} from 'lucide-react';
import './Portfolio.css';

interface SkillsAppProps {
  windowId: string;
}

const CATEGORY_META: Record<string, { label: string; icon: React.ComponentType<{ size?: number }> }> = {
  programming: { label: 'Programming & Languages', icon: Code2 },
  web: { label: 'Frontend & Web Technologies', icon: Globe },
  cybersecurity: { label: 'Cybersecurity & Systems', icon: Shield },
  tools: { label: 'Development Tools & Workflows', icon: Wrench },
  infrastructure: { label: 'Cloud & Infrastructure', icon: Server },
  databases: { label: 'Databases & Storage', icon: Database },
  other: { label: 'Other Skills', icon: Layers },
};

export function SkillsApp({ windowId: _windowId }: SkillsAppProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await skillsApi.list();
      setSkills(data);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSkills();
  }, [fetchSkills]);

  // Filter skills
  const filteredSkills = useMemo(() => {
    return skills.filter((s) => {
      const matchesSearch = !searchQuery.trim() || s.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || s.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [skills, searchQuery, selectedCategory]);

  // Group by category
  const groupedSkills = useMemo(() => {
    const groups = new Map<string, Skill[]>();
    for (const skill of filteredSkills) {
      const cat = skill.category || 'other';
      if (!groups.has(cat)) {
        groups.set(cat, []);
      }
      groups.get(cat)!.push(skill);
    }
    // Sort each group by sort_order
    groups.forEach((list) => {
      list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    });
    return groups;
  }, [filteredSkills]);

  // All categories present
  const presentCategories = useMemo(() => {
    const set = new Set<string>();
    for (const s of skills) {
      if (s.category) set.add(s.category);
    }
    return Array.from(set);
  }, [skills]);

  return (
    <div className="portfolio-window">
      {/* Toolbar */}
      <div className="portfolio-toolbar">
        <div className="portfolio-toolbar-group">
          <div className="portfolio-search-input">
            <Search size={14} style={{ opacity: 0.6 }} />
            <input
              type="text"
              placeholder="Search skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {selectedCategory && (
            <button className="portfolio-btn" onClick={() => setSelectedCategory(null)} title="Clear category filter">
              {CATEGORY_META[selectedCategory]?.label || selectedCategory} &times;
            </button>
          )}
        </div>

        <div className="portfolio-toolbar-group">
          <button
            className="portfolio-btn"
            onClick={() => void fetchSkills()}
            disabled={loading}
            title="Refresh skills from database"
          >
            <RefreshCw size={13} className={loading ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Category Pills Bar */}
      {presentCategories.length > 1 && (
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
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Category:</span>
          <button
            className={`tech-tag ${!selectedCategory ? 'selected' : ''}`}
            onClick={() => setSelectedCategory(null)}
            style={{
              cursor: 'pointer',
              background: !selectedCategory ? 'var(--accent)' : undefined,
              color: !selectedCategory ? '#fff' : undefined,
            }}
          >
            All ({skills.length})
          </button>
          {presentCategories.map((cat) => {
            const count = skills.filter((s) => s.category === cat).length;
            const label = CATEGORY_META[cat]?.label || cat;
            return (
              <button
                key={cat}
                className="tech-tag"
                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                style={{
                  cursor: 'pointer',
                  background: selectedCategory === cat ? 'var(--accent)' : undefined,
                  color: selectedCategory === cat ? '#fff' : undefined,
                }}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      <div className="portfolio-content">
        {loading ? (
          <div className="portfolio-state-box">
            <Loader2 size={32} className="spinning" />
            <div className="portfolio-state-title">Loading Skills...</div>
          </div>
        ) : error ? (
          <div className="portfolio-state-box error">
            <AlertCircle size={36} className="state-icon" />
            <div className="portfolio-state-title">Unable to Load Skills</div>
            <div className="portfolio-state-desc">{error}</div>
            <button className="portfolio-btn" onClick={() => void fetchSkills()}>
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        ) : skills.length === 0 ? (
          <div className="portfolio-state-box">
            <Cpu size={40} className="state-icon" />
            <div className="portfolio-state-title">No Skills Published Yet</div>
            <div className="portfolio-state-desc">
              Skills created and published in the Admin Portal will appear here.
            </div>
          </div>
        ) : groupedSkills.size === 0 ? (
          <div className="portfolio-state-box">
            <Search size={36} className="state-icon" />
            <div className="portfolio-state-title">No Matching Skills</div>
            <div className="portfolio-state-desc">No skills match the query "{searchQuery}".</div>
          </div>
        ) : (
          <div className="skills-categories-grid">
            {Array.from(groupedSkills.entries()).map(([categoryKey, catSkills]) => {
              const meta = CATEGORY_META[categoryKey] || { label: categoryKey, icon: Layers };
              const IconComp = meta.icon;

              return (
                <div key={categoryKey} className="skill-category-card">
                  <div className="skill-category-header">
                    <div className="skill-category-title">
                      <IconComp size={16} />
                      <span>{meta.label}</span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                      {catSkills.length} {catSkills.length === 1 ? 'skill' : 'skills'}
                    </span>
                  </div>

                  <div className="skill-items-grid">
                    {catSkills.map((skill) => {
                      const level = skill.level || 'intermediate';
                      const levelBadgeClass =
                        level === 'expert'
                          ? 'badge-level-expert'
                          : level === 'advanced'
                          ? 'badge-level-advanced'
                          : level === 'beginner'
                          ? 'badge-level-beginner'
                          : 'badge-level-intermediate';

                      return (
                        <div key={skill.id} className="skill-item-pill">
                          <span className="skill-item-name">{skill.name}</span>
                          <span className={`portfolio-badge ${levelBadgeClass}`} style={{ fontSize: '10px' }}>
                            {level}
                          </span>
                        </div>
                      );
                    })}
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
