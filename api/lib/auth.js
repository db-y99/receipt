import { createClient } from '@supabase/supabase-js';





const COOKIE_NAME = 'user_id';
const MAX_AGE = 30 * 24 * 60 * 60;

const LOGIN_VALUES =
  'id,username,password,avatar,fullname,display_name,type__code,type__name,blocked,block_reason,block_reason__code,block_reason__name';

const USER_VALUES =
  'id,username,avatar,fullname,display_name,type__code,type__name,blocked,block_reason,block_reason__code,block_reason__name';

const SESSION_VALUES = 'id,username,fullname,display_name,blocked,block_reason,block_reason__name';

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

export function sessionCookie(userId) {
  const prod = isProduction();
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(userId)}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${MAX_AGE}`,
    `SameSite=${prod ? 'Strict' : 'Lax'}`,
  ];
  if (prod) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookie() {
  const prod = isProduction();
  const parts = [
    `${COOKIE_NAME}=`,
    'HttpOnly',
    'Path=/',
    'Max-Age=0',
    `SameSite=${prod ? 'Strict' : 'Lax'}`,
  ];
  if (prod) parts.push('Secure');
  return parts.join('; ');
}

export function readUserIdFromHeader(header) {
  const raw = Array.isArray(header) ? header.join('; ') : header;
  if (!raw) return null;

  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== COOKIE_NAME) continue;
    try {
      const value = decodeURIComponent(part.slice(eq + 1).trim());
      return value || null;
    } catch {
      return null;
    }
  }

  return null;
}

function invalidCredentials() {
  return {
    status: 401,
    body: { success: false, error: 'Email hoặc mật khẩu không đúng' },
  };
}

function extractUser(data) {
  if (!data || typeof data !== 'object') return null;
  const rows = data.rows;
  if (Array.isArray(rows)) {
    return (rows[0]) ?? null;
  }
  if (rows && typeof rows === 'object' && 'id' in (rows)) {
    return rows;
  }
  if ('id' in (data) && !('rows' in (data))) {
    return data;
  }
  return null;
}

function publicUser(user) {
  const safe = { ...user };
  delete safe.password;
  return safe;
}

function isBlocked(user) {
  return user.blocked === 1 || user.blocked === true;
}

function blockedResponse(user) {
  const reason = user.block_reason__name || user.block_reason;
  const text =
    typeof reason === 'string' && reason.trim() ? reason.trim() : 'Tài khoản đã bị khóa';
  return {
    status: 403,
    body: {
      success: false,
      error: `Tài khoản đã bị khóa. Lý do: ${text}`,
      blocked: true,
      blockReason: text,
    },
  };
}



export function decideProfileAccess(existing, lookupFailed) {
  if (lookupFailed) {
    return { ok: false, status: 500, error: 'Không kiểm tra được hồ sơ. Thử lại sau.' };
  }
  if (!existing) {
    return { ok: false, status: 403, error: 'Tài khoản chưa có hồ sơ trên hệ thống.' };
  }
  if (existing.deleted_at) {
    return { ok: false, status: 403, error: 'Tài khoản đã bị xóa.' };
  }
  return { ok: true };
}

/** Admin vào được. Role khác cần quyền receipt:view trên LoanLook /permissions. */
export function decideReceiptPermission(roleCode, permissionCodes) {
  if (roleCode === 'admin') return { ok: true };
  if (permissionCodes.includes('*') || permissionCodes.includes(RECEIPT_VIEW_PERMISSION)) {
    return { ok: true };
  }
  return {
    ok: false,
    status: 403,
    error: 'Tài khoản không có quyền truy cập phiếu thu.',
  };
}

function roleCodeOf(roles) {
  const row = Array.isArray(roles) ? roles[0] : roles;
  return typeof row?.code === 'string' && row.code ? row.code : null;
}

function permissionCodesOf(rows) {
  if (!Array.isArray(rows)) return [];
  const codes = [];
  for (const row of rows) {
    const permissions = row.permissions;
    const permission = Array.isArray(permissions) ? permissions[0] : permissions;
    if (typeof permission?.code === 'string' && permission.code) codes.push(permission.code);
  }
  return codes;
}

function supabaseSettings() {
  const url = (process.env.SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_ANON_KEY || '').trim();
  if (!url || !key) return null;
  return { url, key };
}

async function profileAccess(userId) {
  const settings = supabaseSettings();
  if (!settings) {
    return { ok: false, status: 500, error: 'Chưa cấu hình phân quyền' };
  }

  const idNum = Number(userId);
  if (!Number.isFinite(idNum)) {
    return decideProfileAccess(null, false);
  }

  try {
    const supabase = createClient(settings.url, settings.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await supabase
      .from('profiles')
      .select('id, deleted_at, role_id, roles:roles(code)')
      .eq('id', idNum)
      .maybeSingle();

    if (error) console.error('[Login] profile lookup failed');
    const profile = (data) ?? null;
    const gate = decideProfileAccess(profile, Boolean(error));
    if (!gate.ok || !profile) return gate;

    const roleCode = roleCodeOf(profile.roles);
    if (roleCode === 'admin') return { ok: true };
    if (!profile.role_id) return decideReceiptPermission(roleCode, []);

    const { data: grants, error: grantError } = await supabase
      .from('role_permissions')
      .select('permissions:permission_id(code)')
      .eq('role_id', profile.role_id);

    if (grantError) {
      console.error('[Login] permission lookup failed');
      return { ok: false, status: 500, error: 'Không kiểm tra được quyền. Thử lại sau.' };
    }

    return decideReceiptPermission(roleCode, permissionCodesOf(grants));
  } catch (error) {
    console.error('[Login] profile lookup error', error instanceof Error ? error.name : 'unknown');
    return decideProfileAccess(null, true);
  }
}

/** Cookie session may open receipt pages and data APIs. */
export async function receiptAccess(userId) {
  return profileAccess(userId);
}

function rejectProfile(status, error, clearCookie) {
  return {
    status,
    body: { success: false, error },
    ...(clearCookie ? { setCookie: clearSessionCookie() } : {}),
  };
}

async function enforceProfile(userId, mode) {
  const gate = await profileAccess(userId);
  if (!('status' in gate)) return null;

  if (mode === 'login') return rejectProfile(gate.status, gate.error, true);

  if (gate.status === 500) {
    return { status: 401, body: { success: false, error: gate.error } };
  }
  return rejectProfile(401, gate.error, true);
}

function readCredentials(rawBody) {
  let body;
  try {
    body = typeof rawBody === 'string' ? JSON.parse(rawBody) : (rawBody ?? {});
  } catch {
    return null;
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) return null;
  return { email, password };
}

export async function loginRequest(apiBase, rawBody) {
  const credentials = readCredentials(rawBody);
  if (!credentials) {
    return {
      status: 400,
      body: { success: false, error: 'Email và mật khẩu là bắt buộc' },
    };
  }

  if (!apiBase.trim()) {
    return {
      status: 500,
      body: { success: false, error: 'Chưa cấu hình API' },
    };
  }

  try {
    const loginResult = await loginWithPassword(apiBase, credentials.email, credentials.password);
    let user = null;

    if (loginResult.status === 'ok') {
      user = loginResult.user;
    } else if (loginResult.status === 'credentials') {
      return invalidCredentials();
    } else {
      console.warn(
        `[Login] /login/ unavailable (${loginResult.detail}); falling back to /data/User/ by username`,
      );
      user = await lookupUserByUsername(apiBase, credentials.email);
      if (!user?.id) return invalidCredentials();
    }

    if (!user?.id) return invalidCredentials();
    if (isBlocked(user)) return blockedResponse(user);

    const profileGate = await enforceProfile(String(user.id), 'login');
    if (profileGate) return profileGate;

    return {
      status: 200,
      body: { success: true, data: user },
      setCookie: sessionCookie(String(user.id)),
    };
  } catch (error) {
    console.error('Login API error', error instanceof Error ? error.name : 'unknown');
    return {
      status: 500,
      body: { success: false, error: 'Không đăng nhập được. Thử lại sau.' },
    };
  }
}

export async function meRequest(
  apiBase,
  cookieHeader,
) {
  const userId = readUserIdFromHeader(cookieHeader);
  if (!userId) {
    return { status: 401, body: { success: false, error: 'Not authenticated' } };
  }

  const profileGate = await enforceProfile(userId, 'me');
  if (profileGate) return profileGate;

  if (apiBase.trim()) {
    const user = await lookupUserById(apiBase, userId);
    if (user === 'error') {
      return {
        status: 200,
        body: { success: true, data: { id: userId } },
      };
    }
    if (!user) {
      return {
        status: 401,
        body: { success: false, error: 'Not authenticated' },
        setCookie: clearSessionCookie(),
      };
    }
    if (isBlocked(user)) {
      const blocked = blockedResponse(user);
      return { ...blocked, setCookie: clearSessionCookie() };
    }
    return {
      status: 200,
      body: {
        success: true,
        data: {
          id: String(user.id),
          username: user.username,
          fullname: user.fullname || user.display_name,
        },
      },
    };
  }

  return {
    status: 200,
    body: { success: true, data: { id: userId } },
  };
}

export function logoutRequest() {
  return {
    status: 200,
    body: { success: true, message: 'Logged out successfully' },
    setCookie: clearSessionCookie(),
  };
}
