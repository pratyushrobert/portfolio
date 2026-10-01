import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { vfs } from '../../../lib/vfs';
import { useWindowStore } from '../../../hooks/useWindows';
import './TerminalApp.css';

interface TerminalAppProps {
  instance: any;
}

export const TerminalApp: React.FC<TerminalAppProps> = ({ instance }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon>(new FitAddon());
  const [history, setHistory] = useState<string[]>([]);
  let historyIndex = 0;
  let currentCommand = '';
  let currentPath = vfs.getCwd();

  const { updateWindowSize } = useWindowStore();

  // Command implementations
  const commands: Record<string, (args: string[]) => Promise<string> | string> = {
    help: () => `Available commands:
  ls [path]       - List directory contents
  cd [path]       - Change directory
  pwd             - Print working directory
  cat <file>      - Display file contents
  mkdir <path>    - Create directory
  touch <file>    - Create empty file
  rm <path>       - Remove file/directory
  rm -r <dir>     - Remove directory recursively
  cp <src> <dst>  - Copy file/directory
  mv <src> <dst>  - Move/rename file/directory
  find <name>     - Find files by name
  tree [path]     - Show directory tree
  clear           - Clear terminal
  history         - Show command history
  whoami          - Current user
  date            - Current date/time
  echo <text>     - Print text
  man <cmd>       - Show command help
  exit            - Close terminal`,

    ls: (args) => {
      const path = args[0] ? vfs.resolvePath(args[0]) : currentPath;
      const result = vfs.list(path);
      if (!result.success) return `ls: ${result.error}`;
      return result.data!.map((n) => {
        const icon = n.type === 'directory' ? '📁' : n.type === 'symlink' ? '🔗' : '📄';
        const perms = n.permissions;
        return `${icon} ${perms} ${n.owner} ${n.name}`;
      }).join('\n');
    },

    cd: (args) => {
      const path = args[0] ? vfs.resolvePath(args[0]) : '/home/user';
      const result = vfs.setCwd(path);
      if (!result.success) return `cd: ${result.error}`;
      currentPath = vfs.getCwd();
      return '';
    },

    pwd: () => currentPath,

    cat: (args) => {
      if (!args[0]) return 'cat: missing file operand';
      const path = vfs.resolvePath(args[0]);
      const result = vfs.readFile(path);
      if (!result.success) return `cat: ${result.error}`;
      return result.data!;
    },

    mkdir: (args) => {
      if (!args[0]) return 'mkdir: missing operand';
      const path = vfs.resolvePath(args[0]);
      const result = vfs.mkdir(path);
      if (!result.success) return `mkdir: ${result.error}`;
      return '';
    },

    touch: (args) => {
      if (!args[0]) return 'touch: missing operand';
      const path = vfs.resolvePath(args[0]);
      const result = vfs.writeFile(path, '');
      if (!result.success) return `touch: ${result.error}`;
      return '';
    },

    rm: (args) => {
      if (!args[0]) return 'rm: missing operand';
      const recursive = args.includes('-r') || args.includes('-rf');
      const path = args.find((a) => !a.startsWith('-')) || '';
      if (!path) return 'rm: missing operand';
      const resolved = vfs.resolvePath(path);
      const result = vfs.rm(resolved, recursive);
      if (!result.success) return `rm: ${result.error}`;
      return '';
    },

    cp: (args) => {
      if (args.length < 2) return 'cp: missing operand';
      const src = vfs.resolvePath(args[0]);
      const dst = vfs.resolvePath(args[1]);
      const result = vfs.cp(src, dst);
      if (!result.success) return `cp: ${result.error}`;
      return '';
    },

    mv: (args) => {
      if (args.length < 2) return 'mv: missing operand';
      const src = vfs.resolvePath(args[0]);
      const dst = vfs.resolvePath(args[1]);
      const result = vfs.mv(src, dst);
      if (!result.success) return `mv: ${result.error}`;
      return '';
    },

    find: (args) => {
      if (!args[0]) return 'find: missing operand';
      const result = vfs.find(args[0]);
      if (!result.success) return `find: ${result.error}`;
      return result.data!.map((n) => {
        const pathParts = [];
        let current: any = n;
        while (current && current.parentId) {
          pathParts.unshift(current.name);
          current = vfs.getNode(current.parentId);
        }
        return '/' + pathParts.join('/');
      }).join('\n');
    },

    tree: (args) => {
      const path = args[0] ? vfs.resolvePath(args[0]) : currentPath;
      const result = vfs.tree(path);
      if (!result.success) return `tree: ${result.error}`;
      return result.data!;
    },

    clear: () => {
      xtermRef.current?.clear();
      return '';
    },

    history: () => history.join('\n'),

    whoami: () => 'user',

    date: () => new Date().toString(),

    echo: (args) => args.join(' '),

    man: (args) => {
      if (!args[0]) return 'man: missing operand';
      const cmd = commands[args[0]];
      if (!cmd) return `man: no manual entry for ${args[0]}`;
      return `MANUAL for ${args[0]}:\n\n${cmd([])}`;
    },

    exit: () => {
      useWindowStore.getState().closeWindow(instance.id);
      return '';
    },
  };

  // Initialize xterm
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const term = new Terminal({
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
    term.open(terminalRef.current);
    fitAddonRef.current.fit();

    // Welcome message
    term.writeln('\x1b[1;36mWelcome to PratyushOS Terminal\x1b[0m');
    term.writeln('Type \x1b[1;33mhelp\x1b[0m for available commands.\n');
    writePrompt(term);

    xtermRef.current = term;

    // Handle input
    term.onData((data) => {
      handleInput(term, data);
    });

    // Handle resize
    const handleResize = () => {
      fitAddonRef.current.fit();
      updateWindowSize(instance.id, terminalRef.current!.clientWidth, terminalRef.current!.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      term.dispose();
      xtermRef.current = null;
      window.removeEventListener('resize', handleResize);
    };
  }, [instance.id, updateWindowSize]);

  const writePrompt = (term: Terminal) => {
    term.write('\x1b[1;32muser@pratyushos\x1b[0m:\x1b[1;34m' + currentPath + '\x1b[0m$ ');
  };

  const handleInput = (term: Terminal, data: string) => {
    if (data === '\r') {
      // Enter key
      term.writeln('');
      const cmdLine = currentCommand.trim();
      if (cmdLine) {
        history.push(cmdLine);
        setHistory([...history]);
        historyIndex = history.length;
        executeCommand(term, cmdLine);
      } else {
        writePrompt(term);
      }
      currentCommand = '';
    } else if (data === '\x7f' || data === '\b') {
      // Backspace
      if (currentCommand.length > 0) {
        currentCommand = currentCommand.slice(0, -1);
        term.write('\b \b');
      }
    } else if (data === '\x1b[A') {
      // Up arrow
      if (historyIndex > 0) {
        historyIndex--;
        replaceCurrentCommand(term, history[historyIndex]);
      }
    } else if (data === '\x1b[B') {
      // Down arrow
      if (historyIndex < history.length - 1) {
        historyIndex++;
        replaceCurrentCommand(term, history[historyIndex]);
      } else if (historyIndex === history.length - 1) {
        historyIndex = history.length;
        replaceCurrentCommand(term, '');
      }
    } else if (data === '\t') {
      // Tab completion - simplified
      term.write(' ');
      currentCommand += ' ';
    } else if (data >= ' ' && data <= '~') {
      // Printable characters
      currentCommand += data;
      term.write(data);
    }
  };

  const replaceCurrentCommand = (term: Terminal, newCmd: string) => {
    // Clear current line
    term.write('\r\x1b[K');
    writePrompt(term);
    currentCommand = newCmd;
    term.write(currentCommand);
  };

  const executeCommand = async (term: Terminal, cmdLine: string) => {
    const [cmd, ...args] = cmdLine.split(' ').filter(Boolean);
    const command = commands[cmd];

    if (!command) {
      term.writeln(`bash: ${cmd}: command not found`);
    } else {
      try {
        const result = await command(args);
        if (result) term.writeln(result);
      } catch (error) {
        term.writeln(`Error: ${error}`);
      }
    }
    writePrompt(term);
  };

  return <div ref={terminalRef} className="terminal-app" />;
};