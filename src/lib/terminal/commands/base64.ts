import type { Command } from '../commands';
import { formatError } from '../commands';
import { unlockDiscovery } from '../../../lib/discovery';

function utf8ToBase64(str: string): string {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  );
}

function base64ToUtf8(str: string): string {
  return decodeURIComponent(
    Array.prototype.map
      .call(atob(str), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
}

export const base64Command: Command = {
  name: 'base64',
  description: 'Encode or decode strings using Base64',
  usage: 'base64 [encode|decode] <text>',
  handler: async (args) => {
    if (args.length === 0) {
      return formatError('base64', 'missing operand\nUsage: base64 [encode|decode] <text>');
    }

    let mode = 'encode';
    let text = '';

    const first = args[0].toLowerCase();
    if (['encode', '-e'].includes(first)) {
      mode = 'encode';
      text = args.slice(1).join(' ');
    } else if (['decode', '-d'].includes(first)) {
      mode = 'decode';
      text = args.slice(1).join(' ');
    } else {
      text = args.join(' ');
    }

    if (!text) {
      return formatError('base64', 'missing text string to process');
    }

    try {
      unlockDiscovery('cryptographer');
      if (mode === 'encode') {
        const encoded = utf8ToBase64(text);
        return encoded;
      } else {
        const decoded = base64ToUtf8(text);
        return decoded;
      }
    } catch {
      return formatError('base64', 'invalid base64 payload provided for decoding');
    }
  },
};
