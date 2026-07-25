/**
 * Resolve WMS profile from the Frappe session cookie (no API token).
 */

function normalizeRoles(raw) {
  if (!raw) return []
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return normalizeRoles(parsed)
    } catch {
      return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    }
  }
  if (!Array.isArray(raw)) return []
  return raw
    .map((r) => {
      if (typeof r === 'string') return r
      if (r && typeof r === 'object') return r.role || r.name || ''
      return ''
    })
    .map((s) => String(s).trim())
    .filter(Boolean)
}

function uniqueRoles(roles) {
  return [...new Set(roles)]
}

function resolveAccessLevel(roles) {
  const lower = roles.map((r) => r.toLowerCase())
  const has = (name) => lower.includes(name.toLowerCase())

  // System Manager / Administrator 계열을 최우선 (지점 역할과 중복 부여돼도 Admin)
  if (
    has('System Manager') ||
    has('Administrator') ||
    has('Admin') ||
    lower.some((r) => r.includes('system manager'))
  ) {
    return 'Admin'
  }
  if (has('Branch Manager')) return 'Manager'
  if (has('Branch Clerk')) return 'Representative'
  return 'Representative'
}

async function fetchRoles(frappeApi, loggedUser) {
  const collected = []

  // 1) 세션 기준 (uid 없이) — 가장 신뢰도 높음
  try {
    const res = await frappeApi.get('/api/method/frappe.get_roles')
    collected.push(...normalizeRoles(res.data?.message))
  } catch (e) {
    console.warn('get_roles (session) failed', e?.response?.status || e)
  }

  // 2) POST + uid (일부 Frappe 버전은 GET params를 무시)
  if (!collected.includes('System Manager')) {
    try {
      const res = await frappeApi.post('/api/method/frappe.get_roles', { uid: loggedUser })
      collected.push(...normalizeRoles(res.data?.message))
    } catch (e) {
      console.warn('get_roles (post uid) failed', e?.response?.status || e)
    }
  }

  // 3) User 문서의 roles 자식 테이블
  if (!collected.includes('System Manager')) {
    try {
      const userRes = await frappeApi.get(`/api/resource/User/${encodeURIComponent(loggedUser)}`)
      const userData = userRes.data?.data
      if (userData?.roles) {
        collected.push(...normalizeRoles(userData.roles))
      }
    } catch (e) {
      console.warn('User roles child-table read failed', e?.response?.status || e)
    }
  }

  // 4) Has Role 리스트
  if (!collected.includes('System Manager')) {
    try {
      const res = await frappeApi.get('/api/method/frappe.client.get_list', {
        params: {
          doctype: 'Has Role',
          filters: JSON.stringify([['parent', '=', loggedUser]]),
          fields: JSON.stringify(['role']),
          parent: 'User',
          limit_page_length: 100
        }
      })
      const rows = res.data?.message || []
      collected.push(...normalizeRoles(rows.map((r) => r.role)))
    } catch (e) {
      console.warn('Has Role list failed', e?.response?.status || e)
    }
  }

  return uniqueRoles(collected)
}

export async function resolveLoginProfile(frappeApi, username) {
  let roles = []
  let branch = null
  let accessLevel = 'Representative'
  let memberName = username
  let fullName = null

  try {
    const loggedRes = await frappeApi.get('/api/method/frappe.auth.get_logged_user')
    const loggedUser = loggedRes.data?.message
    if (!loggedUser || loggedUser === 'Guest') {
      throw new Error('Session not established after login (Guest)')
    }
    memberName = loggedUser

    roles = await fetchRoles(frappeApi, loggedUser)
    accessLevel = resolveAccessLevel(roles)

    // Branch / display name — best effort
    try {
      const userRes = await frappeApi.get(`/api/resource/User/${encodeURIComponent(loggedUser)}`, {
        params: {
          fields: JSON.stringify(['name', 'location', 'full_name'])
        }
      })
      branch = userRes.data?.data?.location || null
      fullName = userRes.data?.data?.full_name || null
    } catch (userErr) {
      console.warn('User resource read failed (session still valid)', userErr?.response?.status || userErr)
    }

    if (!branch) {
      try {
        const permRes = await frappeApi.get('/api/resource/User Permission', {
          params: {
            filters: JSON.stringify([
              ['user', '=', loggedUser],
              ['allow', '=', 'Warehouse']
            ]),
            fields: JSON.stringify(['for_value']),
            limit_page_length: 1
          }
        })
        branch = permRes.data?.data?.[0]?.for_value || null
      } catch (_) {
        /* optional */
      }
    }
  } catch (e) {
    console.error('Failed to resolve login profile from session', e)
    const lower = String(username || '').toLowerCase()
    if (lower === 'administrator') {
      accessLevel = 'Admin'
      roles = ['System Manager']
    }
  }

  if (accessLevel === 'Admin' && !branch) {
    branch = 'TIENDA - K'
  }

  return {
    member_name: memberName,
    full_name: fullName,
    access_level: accessLevel,
    branch_name: branch,
    roles
  }
}
