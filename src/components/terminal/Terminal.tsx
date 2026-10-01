import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { vfs } from '../../lib/vfs';
import { useWindowStore } from '../../stores/useWindowStore';
import { getCommand, getAllCommands } from '../../lib/terminal/commands';
import type { CommandContext } from '../../lib/terminal/commands';
// Import command implementations to register them
import '../../lib/terminal/commands/index';
import './Terminal.css';

interface TerminalProps {
  windowId: string;
  onOpenRequest?: (request: any) => void;
}

export function Terminal({ windowId, onOpenRequest }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon>(new FitAddon());
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Use refs for mutable values accessed in callbacks to avoid stale closures
  const currentCommandRef = useRef('');
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(0);

  const { updateWindowSize, closeWindow } = useWindowStore();

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
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        cursor: '#f5e0dc',
        cursorAccent: '#1e1e2e',
        selectionBackground: 'rgba(137, 180, 250, 0.3)',
        black: '#1e1e2e',
        red: '#f38ba8',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        blue: '#89b4fa',
        magenta: '#f5c2e7',
        cyan: '#94e2d5',
        white: '#bac2de',
        brightBlack: '#6c7086',
        brightRed: '#f38ba8',
        brightGreen: '#a6e3a1',
        brightYellow: '#f9e2af',
        brightBlue: '#89b4fa',
        brightMagenta: '#f5c2e7',
        brightCyan: '#94e2d5',
        brightWhite: '#cdd6f4',
      },
      convertEol: true,
      scrollback: 1000,
    });

    term.loadAddon(fitAddonRef.current);
    term.loadAddon(new WebLinksAddon());
    term.open(terminalRef.current!);
    fitAddonRef.current.fit();

    // Welcome message
    writeWelcome(term);
    writePrompt(term);

    xtermRef.current = term;

    // Handle input
    term.onData((data) => {
      handleInput(term, data);
    });

    // Handle resize
    const handleResize = () => {
      fitAddonRef.current.fit();
      if (terminalRef.current) {
        updateWindowSize(windowId, terminalRef.current.clientWidth, terminalRef.current.clientHeight);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      term.dispose();
      xtermRef.current = null;
      window.removeEventListener('resize', handleResize);
    };
  }, [windowId, updateWindowSize]);

  // Check for open requests from commands
  useEffect(() => {
    const checkOpenRequest = () => {
      const request = (window as any).__MIMIOS_OPEN_REQUEST__;
      if (request && onOpenRequest) {
        onOpenRequest(request);
        delete (window as any).__MIMIOS_OPEN_REQUEST__;
      }
    };
    const interval = setInterval(checkOpenRequest, 100);
    return () => clearInterval(interval);
  }, [onOpenRequest]);

  const writeWelcome = (term: XTerm) => {
    term.writeln('\x1b[1;36mWelcome to MimiOS Terminal\x1b[0m');
    term.writeln('Type \x1b[1;33mhelp\x1b[0m for available commands.\n');
  };

  const writePrompt = (term: XTerm) => {
    const cwd = vfs.getCwd();
    // Show ~ for home directory
    const displayPath = cwd === '/home/pratyush' ? '~' : cwd.replace('/home/pratyush', '~');
    term.write('\x1b[1;32mpratyush@mimi\x1b[0m:\x1b[1;34m' + displayPath + '\x1b[0m$ ');
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
        executeCommand(term, cmdLine);
      } else {
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
      // Up arrow
      if (historyIndexRef.current > 0) {
        const newIndex = historyIndexRef.current - 1;
        setHistoryIndex(newIndex);
        historyIndexRef.current = newIndex;
        replaceCurrentCommand(term, historyRef.current[newIndex]);
      }
    } else if (data === '\x1b[B') {
      // Down arrow
      if (historyIndexRef.current < historyRef.current.length - 1) {
        const newIndex = historyIndexRef.current + 1;
        setHistoryIndex(newIndex);
        historyIndexRef.current = newIndex;
        replaceCurrentCommand(term, historyRef.current[newIndex]);
      } else if (historyIndexRef.current === historyRef.current.length - 1) {
        setHistoryIndex(historyRef.current.length);
        historyIndexRef.current = historyRef.current.length;
        replaceCurrentCommand(term, '');
      }
    } else if (data === '\t') {
      // Tab completion - basic
      term.write(' ');
      currentCommandRef.current += ' ';
    } else if (data >= ' ' && data <= '~') {
      // Printable characters
      currentCommandRef.current += data;
      term.write(data);
    } else if (data === '\x03') {
      // Ctrl+C - cancel current input
      term.writeln('^C');
      currentCommandRef.current = '';
      writePrompt(term);
    } else if (data === '\x0c') {
      // Ctrl+L - clear screen
      term.clear();
      writePrompt(term);
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
        };

        const result = await command.handler(args, ctx);
        if (result !== undefined && result !== '') {
          term.writeln(result);
        }
      } catch (error) {
        term.writeln(`Error: ${error}`);
      }
    }
    writePrompt(term);
  };

  return <div ref={terminalRef} className="terminal" />;
}