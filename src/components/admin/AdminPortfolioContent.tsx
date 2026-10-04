import { useState } from 'react';
import { useAdminConfig, useVfsFileContent } from '../../lib/admin/useAdminConfig';
import { Save, Loader2 } from 'lucide-react';

type TabId = 'about' | 'contact' | 'skills' | 'experience';

interface TabConfig {
  id: TabId;
  label: string;
  content: ReturnType<typeof useVfsFileContent>;
  configKey: string;
  filePath: string;
}

export function AdminPortfolioContent() {
  const { config, updateConfig } = useAdminConfig();
  const [activeTab, setActiveTab] = useState<TabId>('about');
  const [saving, setSaving] = useState(false);

  const aboutContent = useVfsFileContent('/home/pratyush/about.txt');
  const contactContent = useVfsFileContent('/home/pratyush/contact.txt');
  const skillsContent = useVfsFileContent('/home/pratyush/skills/skills.md');
  const experienceContent = useVfsFileContent('/home/pratyush/experience/experience.md');

  const tabs: TabConfig[] = [
    { id: 'about', label: 'About', content: aboutContent, configKey: 'portfolio.aboutText', filePath: '/home/pratyush/about.txt' },
    { id: 'contact', label: 'Contact', content: contactContent, configKey: 'portfolio.contact', filePath: '/home/pratyush/contact.txt' },
    { id: 'skills', label: 'Skills', content: skillsContent, configKey: 'skills', filePath: '/home/pratyush/skills/skills.md' },
    { id: 'experience', label: 'Experience', content: experienceContent, configKey: 'experience', filePath: '/home/pratyush/experience/experience.md' },
  ];

  const activeTabConfig = tabs.find(t => t.id === activeTab);

  const handleSave = async (tabId: TabId) => {
    if (!activeTabConfig) return;

    setSaving(true);
    try {
      const content = activeTabConfig.content.content;
      await activeTabConfig.content.save(content);

      if (tabId === 'about') {
        updateConfig(prev => ({
          ...prev,
          portfolio: { ...prev.portfolio, aboutText: content },
        }));
      } else if (tabId === 'contact') {
        const contact = parseContact(content);
        updateConfig(prev => ({
          ...prev,
          portfolio: { ...prev.portfolio, contact },
        }));
      }

      alert('Saved successfully!');
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const renderTab = () => {
    if (!activeTabConfig) return null;

    return (
      <div className="admin-section">
        <div className="admin-section-header">
          <h2>{activeTabConfig.label}</h2>
          <button
            className="admin-btn admin-btn-primary"
            onClick={() => handleSave(activeTabConfig.id)}
            disabled={saving}
          >
            {saving ? <Loader2 size={16} /> : <Save size={16} />} Save
          </button>
        </div>

        <div className="admin-card">
          <textarea
            value={activeTabConfig.content.content}
            onChange={e => activeTabConfig.content.setContent(e.target.value)}
            className="admin-textarea"
            placeholder={`Edit ${activeTabConfig.label} content...`}
            spellCheck={false}
          />

          {activeTabConfig.content.error && (
            <div className="admin-error">{activeTabConfig.content.error}</div>
          )}
        </div>

        <div className="admin-hint">
          <strong>File:</strong> {activeTabConfig.filePath} |
          <strong>Status:</strong> {activeTabConfig.content.loading ? 'Loading...' :
            activeTabConfig.content.error ? 'Error' : 'Ready'}
        </div>
      </div>
    );
  };

  return (
    <div className="admin-section">
      <div className="admin-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`admin-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id as TabId)}
            disabled={saving}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {renderTab()}
    </div>
  );
}

function parseContact(text: string): Record<string, string> {
  const lines = text.split('\n');
  const contact: Record<string, string> = {};
  lines.forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim().toLowerCase();
      const value = line.slice(colonIndex + 1).trim();
      if (key && value) contact[key] = value;
    }
  });
  return contact;
}