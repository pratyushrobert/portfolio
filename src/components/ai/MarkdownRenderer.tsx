import { useMemo } from 'react';
import MarkdownIt from 'markdown-it';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const md = useMemo(() => {
    const instance = new MarkdownIt({
      html: false, // Security: Never allow raw HTML execution
      xhtmlOut: true,
      breaks: true,
      linkify: true,
      typographer: false,
    });

    // Custom code block renderer with language badge and copy button
    instance.renderer.rules.fence = (tokens, idx) => {
      const token = tokens[idx];
      const info = token.info ? token.info.trim() : '';
      const lang = info ? info.split(/\s+/g)[0] : 'text';
      const code = token.content;
      const escapedCode = instance.utils.escapeHtml(code);
      const encodedCode = encodeURIComponent(code);

      return `<div class="mimi-ai-code-block">
        <div class="mimi-ai-code-header">
          <span class="mimi-ai-code-lang">${instance.utils.escapeHtml(lang)}</span>
          <button type="button" class="mimi-ai-code-copy-btn" data-code="${encodedCode}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="copy-icon"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            <span>Copy</span>
          </button>
        </div>
        <pre class="mimi-ai-code-pre"><code class="language-${instance.utils.escapeHtml(lang)}">${escapedCode}</code></pre>
      </div>`;
    };

    // Safe external links
    const defaultRender =
      instance.renderer.rules.link_open ||
      function (tokens, idx, options, _env, self) {
        return self.renderToken(tokens, idx, options);
      };

    instance.renderer.rules.link_open = (tokens, idx, options, env, self) => {
      const aIndex = tokens[idx].attrIndex('target');
      if (aIndex < 0) {
        tokens[idx].attrPush(['target', '_blank']);
      } else {
        tokens[idx].attrs![aIndex][1] = '_blank';
      }

      const relIndex = tokens[idx].attrIndex('rel');
      if (relIndex < 0) {
        tokens[idx].attrPush(['rel', 'noopener noreferrer']);
      } else {
        tokens[idx].attrs![relIndex][1] = 'noopener noreferrer';
      }

      return defaultRender(tokens, idx, options, env, self);
    };

    return instance;
  }, []);

  const renderedHtml = useMemo(() => {
    return md.render(content || '');
  }, [md, content]);

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const copyBtn = target.closest('.mimi-ai-code-copy-btn') as HTMLButtonElement | null;
    if (!copyBtn) return;

    const encoded = copyBtn.getAttribute('data-code');
    if (!encoded) return;

    try {
      const rawCode = decodeURIComponent(encoded);
      navigator.clipboard.writeText(rawCode).then(() => {
        const textSpan = copyBtn.querySelector('span');
        if (textSpan) {
          const original = textSpan.innerText;
          textSpan.innerText = 'Copied!';
          copyBtn.classList.add('copied');
          setTimeout(() => {
            textSpan.innerText = original;
            copyBtn.classList.remove('copied');
          }, 2000);
        }
      });
    } catch {
      // Fallback
    }
  };

  return (
    <div
      className={`mimi-ai-markdown ${className}`}
      onClick={handleContainerClick}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
}
