/**
 * Vercel serverless proxy for Frappe.
 * Rewrites strip Domain from Set-Cookie so `sid` sticks on the Vercel host
 * (plain rewrites to ktkpos.frappe.cloud leave cookies unusable → Guest → 403).
 */

const FRAPPE_ORIGIN = 'https://ktkpos.frappe.cloud'

export const config = {
  api: {
    bodyParser: false
  }
}

export default async function handler(req, res) {
  try {
    const parts = req.query.path
    const subpath = Array.isArray(parts) ? parts.join('/') : parts || ''
    const qIndex = req.url.indexOf('?')
    const search = qIndex >= 0 ? req.url.slice(qIndex) : ''
    const targetUrl = `${FRAPPE_ORIGIN}/api/${subpath}${search}`

    const headers = {}
    for (const [key, value] of Object.entries(req.headers)) {
      const k = key.toLowerCase()
      if (['host', 'connection', 'content-length', 'transfer-encoding'].includes(k)) continue
      // Prefer session cookie; mixed token+cookie breaks Administrator on production
      if (k === 'authorization') continue
      headers[key] = value
    }
    headers.host = 'ktkpos.frappe.cloud'

    const method = req.method || 'GET'
    let body
    if (!['GET', 'HEAD'].includes(method)) {
      body = await new Promise((resolve, reject) => {
        const chunks = []
        req.on('data', (c) => chunks.push(c))
        req.on('end', () => resolve(Buffer.concat(chunks)))
        req.on('error', reject)
      })
    }

    const upstream = await fetch(targetUrl, {
      method,
      headers,
      body,
      redirect: 'manual'
    })

    res.statusCode = upstream.status

    const skip = new Set(['transfer-encoding', 'content-encoding', 'content-length', 'set-cookie'])
    upstream.headers.forEach((value, key) => {
      if (skip.has(key.toLowerCase())) return
      res.setHeader(key, value)
    })

    const setCookies =
      typeof upstream.headers.getSetCookie === 'function'
        ? upstream.headers.getSetCookie()
        : []
    if (setCookies.length > 0) {
      res.setHeader(
        'Set-Cookie',
        setCookies.map((cookie) =>
          cookie.replace(/;\s*Domain=[^;]*/gi, '').replace(/;\s*SameSite=[^;]*/gi, '; SameSite=Lax')
        )
      )
    }

    const buf = Buffer.from(await upstream.arrayBuffer())
    res.end(buf)
  } catch (err) {
    console.error('Frappe proxy error:', err)
    res.statusCode = 502
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        message: 'Frappe proxy failed',
        error: String(err && err.message ? err.message : err)
      })
    )
  }
}
