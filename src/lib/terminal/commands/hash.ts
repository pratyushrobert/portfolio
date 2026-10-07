import type { Command } from '../commands';
import { formatError } from '../commands';
import { unlockDiscovery } from '../../../lib/discovery';

export const hashCommand: Command = {
  name: 'hash',
  description: 'Compute client-side cryptographic hashes (SHA-256, SHA-512)',
  usage: 'hash [sha256|sha512|sha1] <text>',
  handler: async (args) => {
    if (args.length === 0) {
      return formatError('hash', 'missing input text\nUsage: hash [sha256|sha512] <text>');
    }

    let algo = 'SHA-256';
    let textToHash = '';

    const first = args[0].toLowerCase();
    if (['sha256', 'sha-256'].includes(first)) {
      algo = 'SHA-256';
      textToHash = args.slice(1).join(' ');
    } else if (['sha512', 'sha-512'].includes(first)) {
      algo = 'SHA-512';
      textToHash = args.slice(1).join(' ');
    } else if (['sha1', 'sha-1'].includes(first)) {
      algo = 'SHA-1';
      textToHash = args.slice(1).join(' ');
    } else {
      textToHash = args.join(' ');
    }

    if (!textToHash) {
      return formatError('hash', 'missing text operand after algorithm');
    }

    try {
      const msgUint8 = new TextEncoder().encode(textToHash);
      const hashBuffer = await crypto.subtle.digest(algo, msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      unlockDiscovery('cryptographer');

      return `Algorithm: ${algo} (Client-side WebCrypto)
Input:     "${textToHash}"
Digest:    ${hashHex}`;
    } catch (err) {
      return formatError('hash', `digest computation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
};
