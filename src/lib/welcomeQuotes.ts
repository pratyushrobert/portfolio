/**
 * MimiOS Centralized Welcome Quotes & Tips.
 * Strict Constraint: Every single quote MUST be 5-6 words or fewer.
 */
export const MIMIOS_WELCOME_QUOTES = [
  "Don't sudo everything.",
  "Have you tried turning it off?",
  "Your files miss you.",
  "Press Space. Trust me.",
  "Mimi is watching.",
  "Terminal knows everything.",
  "Ctrl+C saves lives.",
  "Backup before you regret it.",
  "Don't delete system32.",
  "Coffee increases uptime.",
  "Read the error first.",
  "Git commit before chaos.",
  "Your cat owns this machine.",
  "Try the terminal. Seriously.",
  "404: Productivity not found.",
  "sudo make me coffee",
  "Keep calm and debug.",
  "RTFM. Gently.",
  "Cache is probably lying.",
  "One more command.",
  "Reboot heals most wounds.",
  "Clean code, calm mind.",
  "Never deploy on Friday.",
  "Trust the process.",
  "All systems nominal.",
  "Cats rule the kernel.",
  "May the source be with you.",
] as const;

export type WelcomeQuote = (typeof MIMIOS_WELCOME_QUOTES)[number];

/**
 * Returns a stable random quote chosen from the centralized list.
 */
export function getRandomWelcomeQuote(): WelcomeQuote {
  const index = Math.floor(Math.random() * MIMIOS_WELCOME_QUOTES.length);
  return MIMIOS_WELCOME_QUOTES[index];
}
