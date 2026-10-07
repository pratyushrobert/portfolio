import type { Command } from '../commands';
import { formatError } from '../commands';
import { unlockDiscovery } from '../../../lib/discovery';

interface DemoTarget {
  name: string;
  ip: string;
  os: string;
  ports: { port: number; state: string; service: string; version: string }[];
}

const DEMO_TARGETS: Record<string, DemoTarget> = {
  localhost: {
    name: 'localhost (MimiOS Web Environment)',
    ip: '127.0.0.1',
    os: 'MimiOS WebAssembly / Linux Emulation',
    ports: [
      { port: 22, state: 'open', service: 'ssh', version: 'OpenSSH 9.3 (Virtual Shell)' },
      { port: 80, state: 'open', service: 'http', version: 'Vite Client Server v8' },
      { port: 3001, state: 'open', service: 'http-api', version: 'Fastify 5.0 (REST/Auth API)' },
      { port: 443, state: 'closed', service: 'https', version: 'SSL Terminator' },
    ],
  },
  '127.0.0.1': {
    name: 'localhost (MimiOS Web Environment)',
    ip: '127.0.0.1',
    os: 'MimiOS WebAssembly / Linux Emulation',
    ports: [
      { port: 22, state: 'open', service: 'ssh', version: 'OpenSSH 9.3 (Virtual Shell)' },
      { port: 80, state: 'open', service: 'http', version: 'Vite Client Server v8' },
      { port: 3001, state: 'open', service: 'http-api', version: 'Fastify 5.0 (REST/Auth API)' },
    ],
  },
  'demo-server': {
    name: 'demo-server (Portfolio Target Sandbox)',
    ip: '10.0.0.42',
    os: 'Ubuntu 24.04 LTS (Kernel 6.8)',
    ports: [
      { port: 22, state: 'open', service: 'ssh', version: 'OpenSSH 8.9p1' },
      { port: 80, state: 'open', service: 'http', version: 'nginx/1.24.0' },
      { port: 443, state: 'open', service: 'https', version: 'nginx/1.24.0 (TLSv1.3)' },
      { port: 5432, state: 'filtered', service: 'postgresql', version: 'PostgreSQL 16 Database' },
      { port: 8080, state: 'open', service: 'http-proxy', version: 'Custom Reverse Proxy' },
    ],
  },
  portfolio: {
    name: 'portfolio-edge (CDN Edge Node)',
    ip: '192.168.1.100',
    os: 'Alpine Linux v3.19',
    ports: [
      { port: 80, state: 'open', service: 'http', version: 'Cloudflare Pages / Caddy' },
      { port: 443, state: 'open', service: 'https', version: 'TLS v1.3 ECC' },
    ],
  },
  securevault: {
    name: 'securevault-staging (Encrypted Storage Project)',
    ip: '10.10.10.15',
    os: 'Hardened Debian 12 (SELinux enforcing)',
    ports: [
      { port: 22, state: 'open', service: 'ssh', version: 'OpenSSH 9.2 (Key-only)' },
      { port: 8443, state: 'open', service: 'https-vault', version: 'AES-256 GCM API' },
      { port: 9000, state: 'filtered', service: 'grpc', version: 'Internal RPC' },
    ],
  },
};

export const scanCommand: Command = {
  name: 'scan',
  description: 'Simulated network port scanner (educational sandbox)',
  usage: 'scan <demo-server|localhost|portfolio|securevault>',
  handler: async (args) => {
    if (args.length === 0) {
      return formatError(
        'scan',
        'missing target hostname or IP\nUsage: scan <target>\nAvailable demo targets: localhost, demo-server, portfolio, securevault'
      );
    }

    const targetKey = args[0].toLowerCase();
    unlockDiscovery('sim_scan');

    const demo = DEMO_TARGETS[targetKey];

    if (!demo) {
      return `[+] MimiOS Simulated Network Scanner v1.0
[!] Note: Target "${args[0]}" is outside predefined portfolio sandboxes.
[!] Simulating sandbox response for: ${args[0]} (No real packets sent)

PORT     STATE    SERVICE       BANNER
22/tcp   open     ssh           OpenSSH 9.0 (Simulated)
80/tcp   open     http          Demo Web Server
443/tcp  open     https         TLS Gateway
8080/tcp filtered http-proxy    Firewall Filtered

Nmap done: 1 IP address (1 host up) scanned in 0.04 seconds.
*This tool is purely educational and simulated client-side.*`;
    }

    const lines: string[] = [
      `[+] MimiOS Simulated Network Scanner v1.0`,
      `[+] Target: ${demo.name} [${demo.ip}]`,
      `[+] OS Detection: ${demo.os}`,
      ``,
      `PORT       STATE     SERVICE         VERSION`,
    ];

    for (const p of demo.ports) {
      const portStr = `${p.port}/tcp`.padEnd(10);
      const stateStr = p.state.padEnd(9);
      const srvStr = p.service.padEnd(15);
      lines.push(`${portStr}${stateStr}${srvStr}${p.version}`);
    }

    lines.push(``);
    lines.push(`Scan complete: ${demo.ports.length} ports inspected in 0.03s.`);
    lines.push(`*Simulated sandbox environment — no live traffic transmitted.*`);

    return lines.join('\n');
  },
};

export const nmapCommand: Command = {
  ...scanCommand,
  name: 'nmap',
  description: 'Alias for simulated network scanner',
  usage: 'nmap <target>',
};
