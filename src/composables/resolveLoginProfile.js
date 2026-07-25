/**
 * Resolve WMS profile from the Frappe session cookie (no API token).
 * Designed so login still succeeds even if User doctype read is restricted.
 */
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

    // 1) Roles via session method (does not require User doctype read)
    try {
      const rolesRes = await frappeApi.get('/api/method/frappe.get_roles', {
        params: { uid: loggedUser }
      })
      roles = Array.isArray(rolesRes.data?.message) ? rolesRes.data.message : []
    } catch (roleErr) {
      console.warn('frappe.get_roles failed', roleErr)
    }

    // Manager before Clerk — dual-role users should not be demoted
    if (roles.includes('System Manager') || roles.includes('Administrator')) {
      accessLevel = 'Admin'
    } else if (roles.includes('Branch Manager')) {
      accessLevel = 'Manager'
    } else if (roles.includes('Branch Clerk')) {
      accessLevel = 'Representative'
    }

    // 2) Branch / name — best effort (may 403 for some accounts)
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
