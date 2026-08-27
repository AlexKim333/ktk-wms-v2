/**
 * Edge middleware: proxy /api/* → Frappe and rewrite Set-Cookie Domain
 * so session `sid` is stored on the Vercel host.
 * (Vite dist-only deploys often omit /api serverless functions → 404 on login.)
 */

const FRAPPE_ORIGIN = 'https://ktkpos.frappe.cloud'

export const config = {
  matcher: '/api/:path*'
}

// 유료 AI 를 모델 하나에 묶지 않는다. 앞에서부터 시도하고 모델 부재나 과부하
// 시 다음 단계로 넘어간다. 백엔드(meta 연동프로젝트 agent.py)와 같은 구성.
const GEMINI_MODEL_CASCADE = ['gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite']

function rewriteSetCookie(cookie) {
  return cookie
    .replace(/;\s*Domain=[^;]*/gi, '')
    .replace(/;\s*SameSite=[^;]*/gi, '; SameSite=Lax')
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

/**
 * Frappe 세션 검증.
 *
 * 프록시를 열어 두면 주소를 아는 누구나 우리 Gemini 할당량을 소모할 수 있다.
 * 프론트엔드는 항상 세션 쿠키로 동작하므로 로그인된 사용자만 통과시킨다.
 */
async function resolveSessionUser(cookieHeader) {
  if (!cookieHeader) return null
  try {
    const res = await fetch(`${FRAPPE_ORIGIN}/api/method/frappe.auth.get_logged_user`, {
      headers: { cookie: cookieHeader, Accept: 'application/json' }
    })
    if (!res.ok) return null
    const data = await res.json()
    const user = data && data.message
    return user && user !== 'Guest' ? user : null
  } catch (_) {
    return null
  }
}

// 모델 부재(404), 할당량 초과(429), 일시적 서버 오류(5xx)는 다음 모델로 넘긴다.
// 그 밖의 4xx 는 요청 자체가 잘못된 것이므로 재시도해도 같은 결과다.
function shouldTryNextModel(status) {
  return status === 404 || status === 429 || status >= 500
}

/**
 * Gemini 중계. 브라우저에 키를 노출하지 않고 서버에서만 Google 로 호출한다.
 * 프론트엔드가 Gemini 원본 요청·응답 형태를 그대로 다루므로 본문은 가공하지 않는다.
 */
async function handleGeminiProxy(request) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: { message: 'Only POST is supported' } }, 405)
  }

  // VITE_ 접두사 변수는 브라우저 번들에 포함된다. 서버 전용 이름만 읽는다.
  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) {
    return jsonResponse({ error: { message: 'GEMINI_API_KEY is not configured on server' } }, 500)
  }

  const sessionUser = await resolveSessionUser(request.headers.get('cookie'))
  if (!sessionUser) {
    return jsonResponse({ error: { message: 'Frappe 로그인 세션이 필요합니다.' } }, 401)
  }

  // 모델을 여러 번 시도할 수 있으므로 스트림을 먼저 읽어 둔다.
  let bodyText
  try {
    bodyText = await request.text()
  } catch (err) {
    const message = String(err && err.message ? err.message : err)
    return jsonResponse({ error: { message: `요청 본문을 읽지 못했습니다: ${message}` } }, 400)
  }

  let lastStatus = 502
  let lastBody = ''

  for (const model of GEMINI_MODEL_CASCADE) {
    let res
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // 키를 쿼리스트링에 두면 중간 로그에 남는다.
            'x-goog-api-key': geminiKey
          },
          body: bodyText
        }
      )
    } catch (err) {
      lastStatus = 502
      lastBody = JSON.stringify({
        error: { message: String(err && err.message ? err.message : err) }
      })
      continue
    }

    const text = await res.text()
    if (res.ok) {
      return new Response(text, {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Gemini-Model': model }
      })
    }

    lastStatus = res.status
    lastBody = text
    if (!shouldTryNextModel(res.status)) break
  }

  return new Response(lastBody || JSON.stringify({ error: { message: 'Gemini 호출 실패' } }), {
    status: lastStatus,
    headers: { 'Content-Type': 'application/json' }
  })
}

const USER_WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH'])
const CLERK_ONLY_ROLES = new Set(['Branch Clerk'])
const SELF_ALLOWED_ROLES = new Set(['Branch Clerk', 'Branch Manager'])

function isUserResourcePath(pathname) {
  return pathname === '/api/resource/User' || pathname.startsWith('/api/resource/User/')
}

function isFrappeClientWrite(pathname) {
  return (
    pathname === '/api/method/frappe.client.insert' ||
    pathname === '/api/method/frappe.client.save' ||
    pathname === '/api/method/frappe.client.set_value'
  )
}

async function fetchSessionRoles(cookieHeader) {
  if (!cookieHeader) return []
  try {
    const res = await fetch(`${FRAPPE_ORIGIN}/api/method/frappe.get_roles`, {
      headers: { cookie: cookieHeader, Accept: 'application/json' }
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data.message) ? data.message : []
  } catch (_) {
    return []
  }
}

function roleNames(list) {
  if (!Array.isArray(list)) return []
  return list
    .map((r) => (typeof r === 'string' ? r : r && r.role))
    .map((s) => String(s || '').trim())
    .filter(Boolean)
}

function roleGuardMessage(roles, { isSelf, isCreate }) {
  const allowed = isCreate || !isSelf ? CLERK_ONLY_ROLES : SELF_ALLOWED_ROLES
  const illegal = roleNames(roles).filter((n) => !allowed.has(n))
  if (!illegal.length) return null
  return (
    '이 계정은 점원(Branch Clerk) 역할만 부여할 수 있습니다. 시도된 역할: ' +
    illegal.join(', ')
  )
}

function unwrapDoc(payload) {
  let doc = payload && payload.doc !== undefined ? payload.doc : payload
  if (typeof doc === 'string') {
    doc = JSON.parse(doc)
    if (payload && payload.doc !== undefined) payload.doc = doc
  }
  return doc
}

/**
 * 공용 벤치에서는 Server Script 가 실행되지 않는다. POS 트래픽은 이 프록시를
 * 통과하므로, System Manager 가 아닌 세션의 User 쓰기에서 권한 상승을 막는다.
 * ktkpos.frappe.cloud 데스크로 직접 호출하면 이 가드를 우회한다.
 */
function applyUserRoleGuard(pathname, method, sessionUser, payload) {
  if (!payload || typeof payload !== 'object') return null

  if (pathname === '/api/method/frappe.client.set_value') {
    if (payload.doctype !== 'User') return null
    if (payload.fieldname === 'api_key' || payload.fieldname === 'api_secret') {
      return 'API 자격증명은 시스템 관리자만 변경할 수 있습니다.'
    }
    if (payload.fieldname === 'roles') {
      const isSelf = String(payload.name || '') === sessionUser
      return roleGuardMessage(payload.value, { isSelf, isCreate: false })
    }
    return null
  }

  let doc = payload
  if (isFrappeClientWrite(pathname)) {
    try {
      doc = unwrapDoc(payload)
    } catch (_) {
      return '문서를 읽지 못했습니다.'
    }
    if (!doc || doc.doctype !== 'User') return null
  }

  delete payload.api_key
  delete payload.api_secret
  if (doc && typeof doc === 'object') {
    delete doc.api_key
    delete doc.api_secret
  }

  if (!doc || !doc.roles) return null

  const isCreate =
    method === 'POST' &&
    (pathname === '/api/resource/User' || pathname === '/api/method/frappe.client.insert')
  const encoded = pathname.startsWith('/api/resource/User/')
    ? decodeURIComponent(pathname.slice('/api/resource/User/'.length))
    : ''
  const targetName = doc.name || encoded
  const isSelf = Boolean(targetName) && targetName === sessionUser
  return roleGuardMessage(doc.roles, { isSelf, isCreate })
}

export default async function middleware(request) {
  const incoming = new URL(request.url)

  // 🌟 Gemini AI Proxy: 브라우저에 키를 노출하지 않고 서버에서만 Google 로 중계
  if (incoming.pathname.startsWith('/api/ai/gemini')) {
    return handleGeminiProxy(request)
  }

  const method = request.method.toUpperCase()
  let bodyOverride

  const needsRoleGuard =
    USER_WRITE_METHODS.has(method) &&
    (isUserResourcePath(incoming.pathname) || isFrappeClientWrite(incoming.pathname))

  if (needsRoleGuard) {
    const cookieHeader = request.headers.get('cookie')
    const sessionUser = await resolveSessionUser(cookieHeader)
    if (!sessionUser) {
      return jsonResponse({ message: 'Frappe 로그인 세션이 필요합니다.' }, 401)
    }
    const sessionRoles = await fetchSessionRoles(cookieHeader)
    const isAdmin = sessionRoles.some(
      (r) => String(r).toLowerCase() === 'system manager'
    )
    if (!isAdmin) {
      let text
      try {
        text = await request.text()
      } catch (err) {
        return jsonResponse(
          { message: `요청 본문을 읽지 못했습니다: ${String(err && err.message ? err.message : err)}` },
          400
        )
      }
      let payload
      try {
        payload = text ? JSON.parse(text) : {}
      } catch (_) {
        return jsonResponse({ message: 'JSON 형식이 아닙니다.' }, 400)
      }
      const blocked = applyUserRoleGuard(incoming.pathname, method, sessionUser, payload)
      if (blocked) {
        return jsonResponse({ message: blocked, exc_type: 'PermissionError' }, 403)
      }
      bodyOverride = JSON.stringify(payload)
    }
  }

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
    if (bodyOverride !== undefined) {
      init.body = bodyOverride
      headers.set('content-length', String(new TextEncoder().encode(bodyOverride).length))
    } else {
      init.body = request.body
      // Required by undici when forwarding a body stream
      init.duplex = 'half'
    }
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
