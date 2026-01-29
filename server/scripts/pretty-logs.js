#!/usr/bin/env node
const fs = require('fs');
const readline = require('readline');

const COLORS = {
  reset: '\x1b[0m',
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
  bgGreen: '\x1b[42m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
};

function levelBadge(level) {
  const L = (level || '').toLowerCase();
  switch (L) {
    case 'error':
      return `${COLORS.bgRed} ${level.toUpperCase()} ${COLORS.reset}`;
    case 'warn':
      return `${COLORS.bgYellow} ${level.toUpperCase()} ${COLORS.reset}`;
    case 'info':
      return `${COLORS.bgGreen} ${level.toUpperCase()} ${COLORS.reset}`;
    case 'debug':
      return `${COLORS.bgBlue} ${level.toUpperCase()} ${COLORS.reset}`;
    default:
      return `${COLORS.bgMagenta} ${level.toUpperCase()} ${COLORS.reset}`;
  }
}

function prettyLine(obj) {
  // If machine log (JSON), format fields
  const ts = obj.timestamp || obj.time || new Date().toISOString();
  const level = obj.level || obj.levels || 'info';
  const badge = levelBadge(level);
  // Build message
  let msg = obj.message || obj.msg || '';
  if (typeof msg === 'object') msg = JSON.stringify(msg);

  // Build meta: pick common fields
  const parts = [];
  if (obj.traceId) parts.push(`trace:${obj.traceId}`);
  if (obj.context) parts.push(`ctx:${obj.context}`);
  if (obj.event) parts.push(`event:${obj.event}`);
  if (obj.userId) parts.push(`user:${obj.userId}`);
  if (obj.bookingId) parts.push(`booking:${obj.bookingId}`);

  const meta = parts.length ? ' ' + parts.join(' ') : '';

  return `${ts} ${badge} ${msg}${meta}`;
}

function handleLine(line) {
  line = line.trim();
  if (!line) return;
  // try JSON parse
  try {
    const obj = JSON.parse(line);
    console.log(prettyLine(obj));
    return;
  } catch (e) {
    // not JSON, just print
    console.log(line);
  }
}

async function processFile(path) {
  if (!fs.existsSync(path)) {
    console.error('Log file not found:', path);
    process.exit(1);
  }
  const rl = readline.createInterface({
    input: fs.createReadStream(path),
    terminal: false,
  });
  for await (const line of rl) {
    handleLine(line);
  }
}

async function processStdin() {
  const rl = readline.createInterface({
    input: process.stdin,
    terminal: false,
  });
  for await (const line of rl) {
    handleLine(line);
  }
}

(async function main() {
  const arg = process.argv[2];
  if (!arg || arg === '-') {
    await processStdin();
    return;
  }
  await processFile(arg);
})();
