import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimeDirectory = path.dirname(fileURLToPath(import.meta.url));

function stripQuotes(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function loadFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const source = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, name, rawValue] = match;
    if (process.env[name] === undefined) process.env[name] = stripQuotes(rawValue);
  }
  return true;
}

export function loadRuntimeEnv(filePath = process.env.RUNTIME_ENV_FILE) {
  const files = filePath
    ? [filePath]
    : [path.join(runtimeDirectory, '.env.local'), path.join(runtimeDirectory, '.env')];
  const loadedFiles = files.filter(loadFile);
  return { loaded: loadedFiles.length > 0, filePaths: loadedFiles };
}

loadRuntimeEnv();
