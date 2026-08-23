export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function truncateForContext(text: string, maxChars: number): {
  text: string;
  truncated: boolean;
} {
  if (text.length <= maxChars) return { text, truncated: false };
  return { text: `${text.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`, truncated: true };
}
