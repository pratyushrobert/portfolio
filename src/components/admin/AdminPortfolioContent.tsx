import { useEffect, useState } from 'react';
import { portfolioApi, type PortfolioContent } from '../../lib/api/portfolio';
import { getApiErrorMessage } from '../../lib/api/client';
import { vfs } from '../../lib/vfs';
import { Save, Loader2, Check } from 'lucide-react';

type TabId = 'about' | 'contact' | 'skills' | 'experience';

interface TabDefinition {
  id: TabId;
  label: string;
  filePath: string;
}

const TABS: TabDefinition[] = [
  { id: 'about', label: 'About', filePath: '/home/pratyush/about.txt' },
  { id: 'contact', label: 'Contact', filePath: '/home/pratyush/contact.txt' },
  { id: 'skills', label: 'Skills Overview', filePath: '/home/pratyush/skills/skills.md' },
  { id: 'experience', label: 'Experience Overview', filePath: '/home/pratyush/experience/experience.md' },
];

export function AdminPortfolioContent() {
  const [activeTab, setActiveTab] = useState<TabId>('about');
  const [contentMap, setContentMap] = useState<Record<TabId, string>>({
    about: '',
    contact: '',
    skills: '',
    experience: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Load content from backend, falling back to VFS files if empty
  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const backendItems: PortfolioContent[] = await portfolioApi.listAdmin();
        const nextMap: Record<TabId, string> = {
          about: '',
          contact: '',
          skills: '',
          experience: '',
        };

        const backendKeys = new Map<string, string>();
        for (const item of backendItems) {
          backendKeys.set(item.key, item.content);
        }

        for (const tab of TABS) {
          if (backendKeys.has(tab.id)) {
            nextMap[tab.id] = backendKeys.get(tab.id)!;
          } else {
            // Seed from existing VFS file if backend row does not exist yet
            const vfsResult = vfs.readFile(tab.filePath);
            if (vfsResult.success && vfsResult.data) {
              nextMap[tab.id] = vfsResult.data;
            }
          }
        }

        if (active) {
          setContentMap(nextMap);
        }
      } catch (err) {
        if (active) {
          setError(getApiErrorMessage(err));
          // Fall back to VFS files on error
          const fallbackMap: Record<TabId, string> = { ...contentMap };
          for (const tab of TABS) {
            const vfsResult = vfs.readFile(tab.filePath);
            if (vfsResult.success && vfsResult.data) {
              fallbackMap[tab.id] = vfsResult.data;
            }
          }
          setContentMap(fallbackMap);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadData();
    return () => { active = false; };
  }, []);

  const handleSave = async (tabId: TabId) => {
    const textToSave = contentMap[tabId];
    setSaving(true);
    setError(null);
    setSaveSuccess(null);

    try {
      // 1. Authoritative write to backend database
      await portfolioApi.save({ key: tabId, content: textToSave });

      // 2. Synchronize with local VirtualFS file so in-OS editor/cat/terminal reads match
      const currentTab = TABS.find(t => t.id === tabId);
      if (currentTab) {
        const mime = currentTab.filePath.endsWith('.md') ? 'text/markdown' : 'text/plain';
        vfs.writeFile(currentTab.filePath, textToSave, mime);
      }

      setSaveSuccess(`"${currentTab?.label}" content saved to backend database!`);
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const activeTabDef = TABS.find(t => t.id === activeTab) || TABS[0];

  return (
    <div className="admin-section">
      <div className="admin-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`admin-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => { setActiveTab(tab.id); setError(null); setSaveSuccess(null); }}
            disabled={saving}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="admin-section-header" style={{ marginTop: 16 }}>
        <h2>{activeTabDef.label}</h2>
        <button
          className="admin-btn admin-btn-primary"
          onClick={() => handleSave(activeTabDef.id)}
          disabled={saving || loading}
        >
          {saving ? <Loader2 size={16} className="spinning" /> : <Save size={16} />} Save
        </button>
      </div>

      {saveSuccess && (
        <div className="admin-success" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#1a3a2a', border: '1px solid #2e7d32', borderRadius: 6, color: '#81c784', marginBottom: 16 }}>
          <Check size={16} />
          <span>{saveSuccess}</span>
        </div>
      )}

      {error && <div className="admin-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="admin-card">
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 24, color: '#888' }}>
            <Loader2 className="spinning" size={20} />
            <span>Loading content from server...</span>
          </div>
        ) : (
          <textarea
            value={contentMap[activeTab]}
            onChange={e => setContentMap({ ...contentMap, [activeTab]: e.target.value })}
            className="admin-textarea"
            placeholder={`Edit ${activeTabDef.label} content...`}
            spellCheck={false}
            rows={14}
          />
        )}
      </div>

      <div className="admin-hint" style={{ marginTop: 12 }}>
        <strong>Backend Key:</strong> {activeTabDef.id} | <strong>VFS Sync Target:</strong> {activeTabDef.filePath}
      </div>
    </div>
  );
}