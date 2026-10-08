import { useRef, useEffect, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { vfs } from '../../lib/vfs';
import { getCommand, getAllCommands } from '../../lib/terminal/commands';
import type { CommandContext } from '../../lib/terminal/commands';
// Import command implementations to register them
import '../../lib/terminal/commands/index';
import { useBootStore } from '../../stores/useBootStore';
import type { DesktopOpenRequest } from '../../types/desktop';
import './Terminal.css';

interface TerminalProps {
  windowId: string;
  appParams?: Record<string, unknown>;
  onOpenRequest?: (request: DesktopOpenRequest) => void;
}

function getLongestCommonPrefix(strings: string[]): string {
  if (strings.length === 0) return '';
  let prefix = strings[0];
  for (let i = 1; i < strings.length; i++) {
    while (!strings[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
      if (prefix === '') return '';
    }
  }
  return prefix;
}

export function Terminal({ windowId: _windowId, appParams, onOpenRequest }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Use refs for mutable values accessed in callbacks to avoid stale closures
  const currentCommandRef = useRef('');
  const draftCommandRef = useRef('');
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(0);

  // Keep refs in sync with state
  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { historyIndexRef.current = historyIndex; }, [historyIndex]);

  // Initialize xterm
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'JetBrains Mono, Fira Code, monospace',
      theme: {
        background: 'transparent',
        foreground: '#e2e4ea',
        cursor: '#f0f2f5',
        cursorAccent: '#121418',
        selectionBackground: 'rgba(255, 255, 255, 0.2)',
        black: '#121418',
        red: '#e06c75',
        green: '#98c379',
        yellow: '#e5c07b',
        blue: '#61afef',
        magenta: '#b0b4c0',
        cyan: '#56b6c2',
        white: '#d8dbe2',
        brightBlack: '#5c606e',
        brightRed: '#e06c75',
        brightGreen: '#98c379',
        brightYellow: '#e5c07b',
        brightBlue: '#61afef',
        brightMagenta: '#d0d4de',
        brightCyan: '#56b6c2',
        brightWhite: '#ffffff',
      },
      convertEol: true,
      scrollback: 1000,
    });

    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(terminalRef.current);

    // Initial safe fit once font metrics and container dimensions are established
    const initialFit = () => {
      if (
        terminalRef.current &&
        terminalRef.current.clientWidth > 80 &&
        terminalRef.current.clientHeight > 60
      ) {
        try {
          fitAddon.fit();
        } catch {
          // ignore fit error
        }
      }
    };

    if (document.fonts) {
      document.fonts.ready.then(initialFit).catch(initialFit);
    } else {
      setTimeout(initialFit, 50);
    }

    // Welcome message
    writeWelcome(term);

    const initialCmd = (appParams?.command || appParams?.initialCommand) as string | undefined;
    if (initialCmd) {
      writePrompt(term);
      term.writeln(initialCmd);
      void executeCommand(term, initialCmd);
    } else {
      writePrompt(term);
    }

    xtermRef.current = term;

    // Handle input
    term.onData((data) => {
      handleInput(term, data);
    });

    // Handle resize with debounced ResizeObserver and container bounds checking
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let wasHidden = false;

    const safeFit = () => {
      if (!terminalRef.current || !fitAddonRef.current || !xtermRef.current) return;
      const { clientWidth, clientHeight } = terminalRef.current;
      if (clientWidth < 80 || clientHeight < 60) {
        wasHidden = true;
        return;
      }
      try {
        fitAddonRef.current.fit();
        if (wasHidden) {
          xtermRef.current.refresh(0, xtermRef.current.rows - 1);
          wasHidden = false;
        }
      } catch {
        // ignore fit errors during fast unmount/hide
      }
    };

    const handleResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(safeFit, 100);
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    window.addEventListener('resize', handleResize);

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      try {
        term.dispose();
      } catch {
        // ignore
      }
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  // Check for open requests from commands
  useEffect(() => {
    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent<DesktopOpenRequest>;
      if (customEvent.detail && onOpenRequest) {
        onOpenRequest(customEvent.detail);
      }
    };
    window.addEventListener('mimios-open-request', handleOpen);

    // Initial check if one is already pending
    const globalWindow = window as unknown as { __MIMIOS_OPEN_REQUEST__?: DesktopOpenRequest };
    if (globalWindow.__MIMIOS_OPEN_REQUEST__ && onOpenRequest) {
      onOpenRequest(globalWindow.__MIMIOS_OPEN_REQUEST__);
      delete globalWindow.__MIMIOS_OPEN_REQUEST__;
    }

    return () => window.removeEventListener('mimios-open-request', handleOpen);
  }, [onOpenRequest]);

  const writeWelcome = (term: XTerm) => {
    term.writeln('\x1b[1;36mWelcome to MimiOS Terminal\x1b[0m');
    term.writeln('Type \x1b[1;33mhelp\x1b[0m for available commands.\n');
  };

  const writePrompt = (term: XTerm) => {
    const cwd = vfs.getCwd();
    // Show ~ for home directory
    const displayPath = cwd === '/home/pratyush' ? '~' : cwd.replace('/home/pratyush', '~');
    const rawUser = useBootStore.getState().localUser?.name?.trim() || 'pratyush';
    const user = rawUser.toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'pratyush';
    term.write(`\x1b[1;32m${user}@mimi\x1b[0m:\x1b[1;34m${displayPath}\x1b[0m$ `);
  };

  const handleTabCompletion = (term: XTerm) => {
    const rawInput = currentCommandRef.current;
    const lastSpaceIndex = rawInput.lastIndexOf(' ');

    if (lastSpaceIndex === -1) {
      // Command name completion
      const prefix = rawInput.trim();
      const allCmds = Array.from(
        new Set([
          ...getAllCommands().filter((c) => !c.hidden).map((c) => c.name),
          'cls',
          'systeminfo',
        ])
      ).sort();

      const matches = prefix === '' ? allCmds : allCmds.filter((name) => name.startsWith(prefix));

      if (matches.length === 0) {
        return;
      }

      if (matches.length === 1) {
        replaceCurrentCommand(term, matches[0] + ' ');
        return;
      }

      const lcp = getLongestCommonPrefix(matches);
      if (lcp.length > prefix.length) {
        replaceCurrentCommand(term, lcp);
      } else {
        term.writeln('');
        term.writeln(matches.join('  '));
        writePrompt(term);
        term.write(currentCommandRef.current);
      }
    } else {
      // Argument completion (path completion in VFS)
      const prefixBefore = rawInput.slice(0, lastSpaceIndex + 1);
      const arg = rawInput.slice(lastSpaceIndex + 1);

      const lastSlashIndex = arg.lastIndexOf('/');
      let searchDir = '';
      let filePrefix = '';
      let dirPrefix = '';

      if (lastSlashIndex === -1) {
        searchDir = vfs.getCwd();
        filePrefix = arg;
        dirPrefix = '';
      } else {
        const rawDir = arg.slice(0, lastSlashIndex);
        dirPrefix = arg.slice(0, lastSlashIndex + 1);
        filePrefix = arg.slice(lastSlashIndex + 1);
        searchDir = rawDir === '' ? '/' : rawDir;
        if (searchDir.startsWith('~')) {
          searchDir = searchDir.replace(/^~/, '/home/pratyush');
        }
      }

      const listRes = vfs.list(searchDir);
      if (!listRes.success || !listRes.data) {
        return;
      }

      const matches = listRes.data
        .filter((node) => node.name.startsWith(filePrefix))
        .map((node) => ({
          name: node.name,
          isDir: node.type === 'directory',
          display: node.type === 'directory' ? node.name + '/' : node.name,
          completion: node.type === 'directory' ? node.name + '/' : node.name + ' ',
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      if (matches.length === 0) {
        return;
      }

      if (matches.length === 1) {
        const fullCompleted = prefixBefore + dirPrefix + matches[0].completion;
        replaceCurrentCommand(term, fullCompleted);
        return;
      }

      const matchNames = matches.map((m) => m.name);
      const lcp = getLongestCommonPrefix(matchNames);
      if (lcp.length > filePrefix.length) {
        const fullCompleted = prefixBefore + dirPrefix + lcp;
        replaceCurrentCommand(term, fullCompleted);
      } else {
        term.writeln('');
        term.writeln(matches.map((m) => m.display).join('  '));
        writePrompt(term);
        term.write(currentCommandRef.current);
      }
    }
  };

  const handleInput = (term: XTerm, data: string) => {
    if (data === '\r') {
      // Enter key
      term.writeln('');
      const cmdLine = currentCommandRef.current.trim();
      if (cmdLine) {
        const newHistory = [...historyRef.current, cmdLine];
        setHistory(newHistory);
        setHistoryIndex(newHistory.length);
        historyRef.current = newHistory;
        historyIndexRef.current = newHistory.length;
        draftCommandRef.current = '';
        executeCommand(term, cmdLine);
      } else {
        draftCommandRef.current = '';
        writePrompt(term);
      }
      currentCommandRef.current = '';
    } else if (data === '\x7f' || data === '\b') {
      // Backspace
      if (currentCommandRef.current.length > 0) {
        currentCommandRef.current = currentCommandRef.current.slice(0, -1);
        term.write('\b \b');
      }
    } else if (data === '\x1b[A') {
      // Up arrow - preserve draft when moving up from the bottom
      if (historyIndexRef.current > 0) {
        if (historyIndexRef.current === historyRef.current.length) {
          draftCommandRef.current = currentCommandRef.current;
        }
        const newIndex = historyIndexRef.current - 1;
        setHistoryIndex(newIndex);
        historyIndexRef.current = newIndex;
        replaceCurrentCommand(term, historyRef.current[newIndex]);
      }
    } else if (data === '\x1b[B') {
      // Down arrow - restore draft when moving back down to the current prompt
      if (historyIndexRef.current < historyRef.current.length - 1) {
        const newIndex = historyIndexRef.current + 1;
        setHistoryIndex(newIndex);
        historyIndexRef.current = newIndex;
        replaceCurrentCommand(term, historyRef.current[newIndex]);
      } else if (historyIndexRef.current === historyRef.current.length - 1) {
        setHistoryIndex(historyRef.current.length);
        historyIndexRef.current = historyRef.current.length;
        replaceCurrentCommand(term, draftCommandRef.current);
      }
    } else if (data === '\t') {
      // Tab completion
      handleTabCompletion(term);
    } else if (data >= ' ' && data <= '~') {
      // Printable characters
      currentCommandRef.current += data;
      term.write(data);
    } else if (data === '\x03') {
      // Ctrl+C - cancel current input
      term.writeln('^C');
      currentCommandRef.current = '';
      draftCommandRef.current = '';
      setHistoryIndex(historyRef.current.length);
      historyIndexRef.current = historyRef.current.length;
      writePrompt(term);
    } else if (data === '\x0c') {
      // Ctrl+L - clear screen and re-render prompt with current input
      term.clear();
      writePrompt(term);
      term.write(currentCommandRef.current);
    }
  };

  const replaceCurrentCommand = (term: XTerm, newCmd: string) => {
    // Clear current line
    term.write('\r\x1b[K');
    writePrompt(term);
    currentCommandRef.current = newCmd;
    term.write(newCmd);
  };

  const executeCommand = async (term: XTerm, cmdLine: string) => {
    const [cmd, ...args] = cmdLine.split(' ').filter(Boolean);
    const command = getCommand(cmd);

    if (!command) {
      term.writeln(`bash: ${cmd}: command not found`);
    } else {
      try {
        // Build context for command
        const ctx: CommandContext = {
          vfs,
          cwd: vfs.getCwd(),
          history: historyRef.current,
          write: (text: string) => term.write(text),
          writeln: (text: string) => term.writeln(text),
          clear: () => {
            term.clear();
            term.write('\x1b[H');
          },
        };

        const result = await command.handler(args, ctx);
        if (result !== undefined && result !== '') {
          term.writeln(result);
        }

        const globalWindow = window as unknown as { __MIMIOS_OPEN_REQUEST__?: DesktopOpenRequest };
        if (globalWindow.__MIMIOS_OPEN_REQUEST__ && onOpenRequest) {
          onOpenRequest(globalWindow.__MIMIOS_OPEN_REQUEST__);
          delete globalWindow.__MIMIOS_OPEN_REQUEST__;
        }
      } catch (error) {
        term.writeln(`Error: ${error}`);
      }
    }
    writePrompt(term);
  };

  return <div ref={terminalRef} className="terminal" onClick={() => xtermRef.current?.focus()} />;
}