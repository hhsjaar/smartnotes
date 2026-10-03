import { createHmac, timingSafeEqual } from 'crypto';

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 hari

/** Passcode admin. Env ADMIN_PASSCODE menimpa nilai bawaan ini. */
export function getAdminPasscode(): string {
  return process.env.ADMIN_PASSCODE || 'levelup1998';
}

function getSecret(): string {
  return process.env.ADMIN_TOKEN_SECRET || getAdminPasscode();
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('hex');
}

/** Token stateless: "<expiredAtMs>.<hmac>". Dikeluarkan /api/auth setelah passcode benar. */
export function createAdminToken(): string {
  const exp = String(Date.now() + TOKEN_TTL_MS);
  return `${exp}.${sign(exp)}`;
}

export function verifyAdminToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const expected = Buffer.from(sign(exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Baca header "Authorization: Bearer <token>" dan cek keabsahannya. */
export function isAdminRequest(request: Request): boolean {
  const header = request.headers.get('authorization') || '';
  return verifyAdminToken(header.startsWith('Bearer ') ? header.slice(7) : null);
}
