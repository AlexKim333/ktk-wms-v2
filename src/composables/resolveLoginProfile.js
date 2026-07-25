/**
 * Resolve WMS profile from the Frappe session cookie (no API token).
 */
export async function resolveLoginProfile(frappeApi, username) {
  let roles = []
  let branch = null
  let accessLevel = 'Representative'
  let memberName = username

  try {
    const loggedRes = await frappeApi.get('/api/method/frappe.auth.get_logged_user')
    const loggedUser = loggedRes.data?.message
    if (!loggedUser || loggedUser === 'Guest') {
      throw new Error('Session not established after login')
    }
    memberName = loggedUser

    const rolesRes = await frappeApi.get('/api/method/frappe.get_roles', {
      params: { uid: loggedUser }
    })
    roles = Array.isArray(rolesRes.data?.message) ? rolesRes.data.message : []

    // Manager before Clerk — dual-role users should not be demoted
    if (roles.includes('System Manager') || roles.includes('Administrator')) {
      accessLevel = 'Admin'
    } else if (roles.includes('Branch Manager')) {
      accessLevel = 'Manager'
    } else if (roles.includes('Branch Clerk')) {
      accessLevel = 'Representative'
    }

    try {
      const userRes = await frappeApi.get(`/api/resource/User/${encodeURIComponent(loggedUser)}`, {
        params: {
          fields: JSON.stringify(['name', 'location', 'full_name'])
        }
      })
      branch = userRes.data?.data?.location || null
    } catch (_) {
      /* User read may be restricted; fall through to User Permission */
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
    access_level: accessLevel,
    branch_name: branch,
    roles
  }
}
