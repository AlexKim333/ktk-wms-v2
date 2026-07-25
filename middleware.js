/**
 * Edge middleware: proxy /api/* → Frappe and rewrite Set-Cookie Domain
 * so session `sid` is stored on the Vercel host.
 * (Vite dist-only deploys often omit /api serverless functions → 404 on login.)
 */

const FRAPPE_ORIGIN = 'https://ktkpos.frappe.cloud'

export const config = {
  matcher: '/api/:path*'
}

function rewriteSetCookie(cookie) {
  return cookie
    .replace(/;\s*Domain=[^;]*/gi, '')
    .replace(/;\s*SameSite=[^;]*/gi, '; SameSite=Lax')
}

export default async function middleware(request) {
  const incoming = new URL(request.url)
  const target = new URL(incoming.pathname + incoming.search, FRAPPE_ORIGIN)

  const headers = new Headers(request.headers)
  headers.delete('host')
  // Avoid token+cookie dual auth confusion
  headers.delete('authorization')
  headers.set('host', 'ktkpos.frappe.cloud')

  const init = {
    method: request.method,
    headers,
    redirect: 'manual'
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body
    // Required by undici when forwarding a body stream
    init.duplex = 'half'
  }

  let upstream
  try {
    upstream = await fetch(target, init)
  } catch (err) {
    return new Response(
      JSON.stringify({
        message: 'Frappe proxy failed',
        error: String(err && err.message ? err.message : err)
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const outHeaders = new Headers()
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase()
    if (k === 'set-cookie' || k === 'content-encoding' || k === 'transfer-encoding') return
    outHeaders.append(key, value)
  })

  const getSetCookie = upstream.headers.getSetCookie?.bind(upstream.headers)
  const cookies = typeof getSetCookie === 'function' ? getSetCookie() : []
  for (const cookie of cookies) {
    outHeaders.append('set-cookie', rewriteSetCookie(cookie))
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders
  })
}
