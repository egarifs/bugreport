const SECRET_PATTERNS = [
  /Bearer\s+[A-Za-z0-9_\-\.]{15,}/gi,
  /(?:api[_-]?key|access[_-]?token|secret|password)\s*[:=]\s*["']?([A-Za-z0-9_\-\.]{8,})["']?/gi,
  /(?:set-cookie|cookie)\s*:\s*([^;\r\n]+)/gi,
  /sk-ant-[A-Za-z0-9_\-]{20,}/gi, // Claude API key
  /AIza[0-9A-Za-z-_]{35}/g,       // Google API key
  /gh[pousr]_[A-Za-z0-9_]{36,}/g, // GitHub token
];

export function redactSecrets(input: string): string {
  if (!input) return input;
  let out = input;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, (match) => {
      if (match.toLowerCase().startsWith("bearer ")) {
        return "Bearer [REDACTED]";
      }
      if (match.startsWith("sk-ant-") || match.startsWith("AIza") || match.startsWith("gh")) {
        return "[REDACTED_SECRET]";
      }
      return match.replace(/[:=]\s*["']?([A-Za-z0-9_\-\.]{8,})["']?/, ": [REDACTED]");
    });
  }
  return out;
}
