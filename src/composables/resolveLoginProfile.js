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

async function fetchRolesFallback(frappeApi, loggedUser, initialRoles) {
  const collected = [...initialRoles]
  const pushRoles = (raw) => {
    collected.push(...normalizeRoles(raw))
  }

  // 백업 1: POST + uid 및 Has Role 리스트 조회 (병렬 실행)
  const [postRes, hasRoleRes] = await Promise.allSettled([
    frappeApi.post('/api/method/frappe.get_roles', { uid: loggedUser }),
    frappeApi.get('/api/method/frappe.client.get_list', {
      params: {
        doctype: 'Has Role',
        filters: JSON.stringify([['parent', '=', loggedUser]]),
        fields: JSON.stringify(['role']),
        parent: 'User',
        limit_page_length: 200
      }
    })
  ])

  if (postRes.status === 'fulfilled') pushRoles(postRes.value.data?.message)
  if (hasRoleRes.status === 'fulfilled') {
    const rows = hasRoleRes.value.data?.message || []
    pushRoles(rows.map((r) => r.role))
  }

  // 백업 2: 여전히 Admin 권한이 감지되지 않은 경우에만 쿠키 전파 지연(250ms) 후 1회 재시도
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

    // 1단계 (고속 병렬 조회): 핵심 API 2개(세션 get_roles + User 문서 1회)를 동시에 실행
    const [rolesRes, userRes] = await Promise.allSettled([
      frappeApi.get('/api/method/frappe.get_roles'),
      frappeApi.get(`/api/resource/User/${encodeURIComponent(loggedUser)}`)
    ])

    const collectedRoles = []
    if (rolesRes.status === 'fulfilled') {
      collectedRoles.push(...normalizeRoles(rolesRes.value.data?.message))
    }

    if (userRes.status === 'fulfilled') {
      const userData = userRes.value.data?.data
      if (userData) {
        branch = userData.location || null
        fullName = userData.full_name || null
        if (userData.roles) collectedRoles.push(...normalizeRoles(userData.roles))
      }
    }

    roles = uniqueRoles(collectedRoles)
    accessLevel = resolveAccessLevel(roles)

    // Frappe 기본 Administrator 계정은 항상 Admin
    if (/^administrator$/i.test(loggedUser)) {
      accessLevel = 'Admin'
      if (!hasAdminRole(roles)) roles = uniqueRoles([...roles, 'System Manager'])
    }

    // 2단계 (Smart Fallback): 1단계에서 권한이 비어있거나 누락 의심 시에만 백업 로직 실행
    const needsRoleFallback = roles.length === 0 || (/^administrator$/i.test(loggedUser) && !hasAdminRole(roles))
    if (needsRoleFallback) {
      roles = await fetchRolesFallback(frappeApi, loggedUser, roles)
      accessLevel = resolveAccessLevel(roles)
    }

    // 지점 정보가 없고 Admin도 아닌 경우에만 User Permission 조회 (백업)
    if (!branch && accessLevel !== 'Admin') {
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
