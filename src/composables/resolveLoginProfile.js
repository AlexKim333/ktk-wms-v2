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

function isAdminRoleName(role) {
  const s = String(role || '').toLowerCase().trim()
  if (!s) return false
  return (
    s === 'system manager' ||
    s === 'administrator' ||
    s === 'admin' ||
    s.includes('system manager')
  )
}

function hasAdminRole(roles) {
  return (roles || []).some(isAdminRoleName)
}

function resolveAccessLevel(roles) {
  // System Manager / Administrator 계열을 최우선 (지점 역할과 중복 부여돼도 Admin)
  if (hasAdminRole(roles)) return 'Admin'

  const lower = (roles || []).map((r) => String(r).toLowerCase())
  const has = (name) => lower.includes(name.toLowerCase())
  if (has('Branch Manager')) return 'Manager'
  if (has('Branch Clerk')) return 'Representative'
  return 'Representative'
}

async function fetchRoles(frappeApi, loggedUser) {
  const collected = []

  const pushRoles = (raw) => {
    collected.push(...normalizeRoles(raw))
  }

  // 모든 소스를 병합 (하나라도 System Manager가 있으면 Admin 판정 가능)
  // 1) 세션 기준 get_roles
  try {
    const res = await frappeApi.get('/api/method/frappe.get_roles')
    pushRoles(res.data?.message)
  } catch (e) {
    console.warn('get_roles (session) failed', e?.response?.status || e)
  }

  // 2) POST + uid
  try {
    const res = await frappeApi.post('/api/method/frappe.get_roles', { uid: loggedUser })
    pushRoles(res.data?.message)
  } catch (e) {
    console.warn('get_roles (post uid) failed', e?.response?.status || e)
  }

  // 3) User 문서 roles 자식 테이블 (전체 필드)
  try {
    const userRes = await frappeApi.get(`/api/resource/User/${encodeURIComponent(loggedUser)}`)
    const userData = userRes.data?.data
    if (userData?.roles) pushRoles(userData.roles)
  } catch (e) {
    console.warn('User roles child-table read failed', e?.response?.status || e)
  }

  // 4) Has Role 리스트
  try {
    const res = await frappeApi.get('/api/method/frappe.client.get_list', {
      params: {
        doctype: 'Has Role',
        filters: JSON.stringify([['parent', '=', loggedUser]]),
        fields: JSON.stringify(['role']),
        parent: 'User',
        limit_page_length: 200
      }
    })
    const rows = res.data?.message || []
    pushRoles(rows.map((r) => r.role))
  } catch (e) {
    console.warn('Has Role list failed', e?.response?.status || e)
  }

  // 5) 로그인 직후 쿠키 지연 대비: Admin 역할이 없으면 한 번 더 세션 roles 재시도
  if (!hasAdminRole(collected)) {
    await new Promise((r) => setTimeout(r, 250))
    try {
      const res = await frappeApi.get('/api/method/frappe.get_roles')
      pushRoles(res.data?.message)
    } catch (_) {
      /* ignore */
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

    // Frappe 기본 Administrator 계정은 항상 Admin
    if (/^administrator$/i.test(loggedUser)) {
      accessLevel = 'Admin'
      if (!hasAdminRole(roles)) roles = uniqueRoles([...roles, 'System Manager'])
    }

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

    console.info('[WMS auth] roles=', roles, 'access_level=', accessLevel, 'user=', loggedUser)
  } catch (e) {
    console.error('Failed to resolve login profile from session', e)
    const lower = String(username || '').toLowerCase()
    if (lower === 'administrator') {
      accessLevel = 'Admin'
      roles = ['System Manager']
    }
  }

  // Admin은 지점 location이 있어도 HQ로 취급 (지점장 UI로 오인 방지)
  if (accessLevel === 'Admin') {
    if (!branch) branch = 'TIENDA - K'
  }

  return {
    member_name: memberName,
    full_name: fullName,
    access_level: accessLevel,
    branch_name: branch,
    roles
  }
}
