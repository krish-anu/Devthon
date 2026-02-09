export function normalizeSriLankaPhone(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  // Remove spaces, dashes, parentheses
  const digitsOnly = s.replace(/[^0-9+]/g, "");

  // If starts with +, remove + for processing
  const plain = digitsOnly.startsWith("+") ? digitsOnly.slice(1) : digitsOnly;

  // If the user provided leading 0 (e.g., 0771234567) -> drop leading 0 and treat as local
  if (plain.length === 10 && plain.startsWith("0")) {
    const local = plain.slice(1);
    if (/^[0-9]{9}$/.test(local)) return `+94${local}`;
  }

  // If they provided local 9-digit number
  if (/^[0-9]{9}$/.test(plain)) {
    return `+94${plain}`;
  }

  // If they provided 94XXXXXXXXX (11 digits)
  if (/^94[0-9]{9}$/.test(plain)) {
    return `+${plain}`;
  }

  // If they provided +94XXXXXXXXX
  if (/^\+94[0-9]{9}$/.test(digitsOnly)) {
    return digitsOnly;
  }

  return null;
}

export function formatSriLankaPhone(raw: string | undefined | null): string | null {
  const normalized = normalizeSriLankaPhone(raw);
  if (!normalized) return null;
  // normalized is +94 + 9 digits
  const local = normalized.slice(3); // drop +94
  // group 2-3-4
  const part1 = local.slice(0, 2);
  const part2 = local.slice(2, 5);
  const part3 = local.slice(5, 9);
  return `+94 ${part1} ${part2} ${part3}`;
}

// For display: if input already formatted, return formatted, otherwise return input
export function formatPhoneForDisplay(raw: string | undefined | null): string {
  const formatted = formatSriLankaPhone(raw);
  if (formatted) return formatted;
  return raw ?? "";
}

export function isValidSriLankaPhone(raw: string | undefined | null): boolean {
  return normalizeSriLankaPhone(raw) !== null;
}
