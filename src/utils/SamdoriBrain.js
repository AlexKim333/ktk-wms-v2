import axios from 'axios';
import FlexSearch from 'flexsearch';

let flexIndex = null;
let flexIndexKey = '';

function koDigit(token) {
  const t = String(token || '').trim()
  const map = {
    영: 0, 공: 0, 일: 1, 한: 1, 하나: 1, 이: 2, 두: 2, 둘: 2,
    삼: 3, 세: 3, 셋: 3, 사: 4, 네: 4, 넷: 4, 오: 5, 다섯: 5,
    육: 6, 여섯: 6, 칠: 7, 일곱: 7, 팔: 8, 여덟: 8, 구: 9, 아홉: 9
  }
  if (t === '') return 0
  if (/^\d+$/.test(t)) return Number(t)
  return map[t] ?? null
}

// 품번은 최대 4자리라 '만' 단위는 다루지 않는다 ('만일', '만약' 같은 일상어 오변환 방지)
const KO_UNITS = [
  ['천', 1000],
  ['백', 100],
  ['십', 10]
]

/** "백육십" → 160, "삼천삼백삼십일" → 3331, "칠천일" → 7001 */
function parseKoreanNumberChunk(text) {
  let t = String(text || '').replace(/\s+/g, '')
  if (!t) return ''
  if (/\d/.test(t)) {
    const m = t.match(/\d+/g)
    return m ? m.join('') : ''
  }
  let n = 0
  for (const [unit, mul] of KO_UNITS) {
    const idx = t.indexOf(unit)
    if (idx < 0) continue
    const head = t.slice(0, idx)
    const count = head === '' ? 1 : koDigit(head)
    if (count == null) return ''
    n += count * mul
    t = t.slice(idx + 1)
  }
  if (t) {
    const ones = koDigit(t)
    if (ones == null) return n ? String(n) : ''
    n += ones
  }
  return n ? String(n) : ''
}

/**
 * 자릿수를 하나씩 읽은 발화 → 숫자열 ("삼삼삼일" → "3331", "사삼공팔" → "4308")
 * 단위어(십/백/천/만)가 섞이면 수사 계산식이므로 여기서 처리하지 않는다.
 * "이사"(=42?) 같은 일상어 오변환을 막기 위해 3음절 이상만 인정한다.
 */
function parseKoreanDigitSequence(text) {
  const t = String(text || '').replace(/\s+/g, '')
  if (t.length < 3) return ''
  if (/[십백천만]/.test(t)) return ''
  let out = ''
  for (const ch of t) {
    const d = koDigit(ch)
    if (d == null || d > 9) return ''
    out += String(d)
  }
  return out
}

/**
 * 발화 속 한글 수사를 아라비아 숫자로 치환 ("삼삼삼일-일 알라르꼰" → "3331-1 알라르꼰").
 * 품번 신호 판정과 오답 차단 가드가 STT 표기 방식에 좌우되지 않도록 하기 위한 전처리.
 */
function spokenNumeralsToDigits(text) {
  const s = String(text || '')
  if (!s) return ''
  const digitized = s.replace(/[영공일이삼사오육칠팔구십백천]{2,}/g, (run) => {
    const viaUnits = /[십백천]/.test(run) ? parseKoreanNumberChunk(run) : ''
    if (viaUnits && viaUnits.length >= 2) return viaUnits
    const viaDigits = parseKoreanDigitSequence(run)
    if (viaDigits && viaDigits.length >= 2) return viaDigits
    return run
  })

  // 하이픈 뒤 한 자리 서브코드 ("3331-일" → "3331-1"). 뒤에 다른 한글이 붙으면 일상어이므로 제외
  return digitized.replace(/(\d-)([영공일이삼사오육칠팔구])(?![가-힣])/g, (_, head, syllable) => {
    const d = koDigit(syllable)
    return d == null ? `${head}${syllable}` : `${head}${d}`
  })
}

const COLOR_ALIASES = {
  네그로: 'NEGRO', negro: 'NEGRO', 검정: 'NEGRO', 검정색: 'NEGRO', 블랙: 'NEGRO', black: 'NEGRO',
  베이지: 'BEIGE', beige: 'BEIGE',
  블랑코: 'BLANCO', blanco: 'BLANCO', 화이트: 'BLANCO', 하얀: 'BLANCO', 흰색: 'BLANCO', white: 'BLANCO',
  로호: 'ROJO', rojo: 'ROJO', 빨강: 'ROJO', 빨간색: 'ROJO', red: 'ROJO',
  아술: 'AZUL', azul: 'AZUL', 파랑: 'AZUL', 파란색: 'AZUL', blue: 'AZUL'
}

function resolveColorToken(color, rawSpoken) {
  const fromField = String(color || '').trim()
  if (fromField) {
    const hit = COLOR_ALIASES[fromField.toLowerCase()] || fromField.toUpperCase()
    return hit
  }
  const raw = String(rawSpoken || '')
  for (const [k, v] of Object.entries(COLOR_ALIASES)) {
    if (raw.toLowerCase().includes(k.toLowerCase())) return v
  }
  return ''
}

/**
 * Gemini가 준 발음 문자열 → 로컬 검색 키
 * 예: "피 백육십 네그로" → { prefix: "P-160", color: "NEGRO" }
 */
function normalizeSpokenQuery(rawSpoken, color, validItems = []) {
  let s = String(rawSpoken || '').trim()
  const resolvedColor = resolveColorToken(color, s)

  // 한글로 읽은 코드("삼삼삼일-일", "삼천삼백삼십일")를 숫자로 되돌린 뒤 동일 경로로 처리
  s = spokenNumeralsToDigits(s)

  // 이미 알파벳 정식 코드 (P-160 / P-160-REY-300 / L-OP80 / L-OP80-NEGRO-12)
  if (/^[A-Za-z]+-[A-Za-z0-9]+/.test(s)) {
    const m = s.toUpperCase().match(/^([A-Z]+-[A-Z0-9]+)/)
    return { prefix: m ? m[1] : s.toUpperCase(), color: resolvedColor, flexQuery: s.toUpperCase() }
  }
  // 숫자로 시작하는 코드/단축번호 (3331, 3331-SURTIDO-200) - 단, DB에 해당 숫자 토큰이 존재하는 경우에만
  if (/^\d{2,}/.test(s)) {
    const m = s.toUpperCase().match(/^(\d{2,})/)
    const numStr = m ? m[1] : s.toUpperCase()
    const hasTokenInDb =
      Array.isArray(validItems) &&
      validItems.length > 0 &&
      validItems.some((i) => {
        const u = String(i).toUpperCase()
        const numRegex = new RegExp(`(^|[^0-9])${numStr}([^0-9]|$)`, 'i')
        return numRegex.test(u)
      })
    if (hasTokenInDb) {
      return { prefix: numStr, color: resolvedColor, flexQuery: s.toUpperCase() }
    }
  }

  // 접두 문자 (명시적 발음이나 알파벳이 없으면 비워둠)
  let letter = ''
  if (/^(비|비이|b\b)/i.test(s) || /^b/i.test(s.replace(/\s/g, ''))) letter = 'B'
  else if (/^(피|프이|pee|p\b)/i.test(s) || /^p/i.test(s.replace(/\s/g, ''))) letter = 'P'
  else {
    // 알라르꼰 등 창고명이 알파벳으로 들어오는 경우 제외하고, 코드 접두 알파벳만
    const latin = s.match(/^[A-Za-z]/) || s.match(/\b[A-Za-z](?=-\d)/)
    if (latin) letter = latin[0].toUpperCase()
  }

  // 숫자: 아라비아 또는 한글 수사
  let num = ''
  const arab = s.match(/\d+/)
  if (arab) {
    num = arab[0]
  } else {
    const hangulChunk = s
      .replace(/[A-Za-z]/g, ' ')
      .replace(/피|비|네그로|베이지|블랑코|로호|아술|검정|하얀|빨강|파랑|블랙|화이트|색/gi, ' ')
      .trim()
    num = parseKoreanNumberChunk(hangulChunk)
  }

  let prefix = ''
  if (num) {
    if (letter) {
      prefix = `${letter}-${num}`
    } else {
      // 명시적 알파벳을 말하지 않은 경우: DB에 해당 숫자 독립 토큰이 존재하면 숫자 자체를 prefix로 사용
      const numStr = String(num)
      const hasTokenInDb =
        Array.isArray(validItems) &&
        validItems.length > 0 &&
        validItems.some((i) => {
          const u = String(i).toUpperCase()
          const numRegex = new RegExp(`(^|[^0-9])${numStr}([^0-9]|$)`, 'i')
          return numRegex.test(u)
        })
      if (hasTokenInDb) {
        prefix = numStr
      } else {
        // DB에 숫자가 포함된 품목이 아예 없으면 관습적 P- 접두사 사용 (예: DB에 없는 "999" -> "P-999")
        prefix = `P-${numStr}`
      }
    }
  }

  const flexQuery = [prefix || s, resolvedColor].filter(Boolean).join(' ')
  return { prefix, color: resolvedColor, flexQuery }
}

function initFlexSearch(validItems) {
  if (!validItems || validItems.length === 0) return
  const key = `${validItems.length}:${validItems[0]}:${validItems[validItems.length - 1]}`
  if (flexIndex && flexIndexKey === key) return
  flexIndex = new FlexSearch.Document({
    document: {
      id: 'id',
      index: ['code']
    },
    tokenize: 'forward'
  })
  validItems.forEach((item, idx) => {
    flexIndex.add({ id: idx, code: String(item) })
  })
  flexIndexKey = key
}

/** 창고명만 말한 후속 답변인지 (품목/수량 명령 아님) */
function looksLikeWarehouseUtterance(text) {
  const raw = spokenNumeralsToDigits(String(text || '').trim())
  if (!raw || raw.length > 40) return false
  // 숫자(2자리 이상)가 있거나 품목/담기/수량/질문 신호가 있으면 창고명만 말한 후속이 절대 아님
  if (/\d{2,}/.test(raw)) return false
  if (/(불또|bulto|박스|담아|넣어|추가|재고|검색|품명|품번|피\s|전송|장바구니|몇\s*개|몇개|얼마|있는가|있어|있지|있나|있어요|조회|확인|수량|개수|개야)/i.test(raw)) {
    return false
  }
  if (/([A-Za-z]{1,4}-?\d+|\d{2,})/.test(raw)) return false
  // STT 오인식 포함 (알라르꼰/까르멘 등)
  return /(알라르꼰|알라르콘|알라르권|알라르고|알라르|알라콘|알라꼰|alarcon|alarcón|본사|메인|main|본부|carmen|까르멘|카르멘|까르맨|카르맨|까르면|카르면|까멘|티엔다|tienda|tienda|polanco|폴랑코|insurgentes|satelite|satélite|queretaro|querétaro|창고|지점|sucursal|warehouse)/i.test(
    raw
  )
}

/**
 * 발화에 '정체성'이 강한 품번 신호가 있는지 (숫자 코드/정식코드)
 * — 세션 메모리로 덮어쓰면 안 되는 경우
 */
function hasStrongItemIdentity(text) {
  const original = String(text || '').trim()
  if (!original || looksLikeWarehouseUtterance(original)) return false
  // 한글로 읽은 숫자("삼삼삼일", "삼천삼백삼십일")도 아라비아 숫자와 동일한 품번 신호로 취급
  const raw = spokenNumeralsToDigits(original)
  if (/[A-Za-z]{1,4}-?\d{2,}/i.test(raw)) return true
  if (/\d{2,}/.test(raw)) return true
  const { prefix } = normalizeSpokenQuery(raw, '')
  return !!(prefix && /\d{2,}/.test(prefix))
}

/**
 * 매칭된 품번이 발화의 숫자/코드 신호와 일치하는지
 * 예: 발화 "3331" vs 매칭 P-160-REY-300 → false
 */
function itemMatchesSpokenIdentity(itemCode, spokenText) {
  const item = String(itemCode || '').toUpperCase()
  const original = String(spokenText || '').trim()
  if (!item || !original) return true
  if (!hasStrongItemIdentity(original)) return true
  const spoken = spokenNumeralsToDigits(original)

  const itemCompact = item.replace(/[^A-Z0-9]/g, '')

  // 정식 코드 형태가 발화에 있으면 그 접두가 품번에 포함되어야 함
  const codeMatches = spoken.match(/[A-Za-z]{1,3}-?\d{2,}/gi) || []
  if (codeMatches.length) {
    return codeMatches.some((c) => {
      const compact = c.toUpperCase().replace(/[^A-Z0-9]/g, '')
      return itemCompact.includes(compact) || compact.includes(itemCompact.slice(0, compact.length))
    })
  }

  // 한글 정규화 접두 (피 백육십 → P-160)
  const { prefix } = normalizeSpokenQuery(spoken, '')
  if (prefix) {
    const p = prefix.toUpperCase()
    if (item === p || item.startsWith(`${p}-`) || itemCompact.includes(p.replace(/-/g, ''))) {
      return true
    }
  }

  // 발화 숫자(긴 것 우선)가 품번 안에 있어야 함
  const nums = (spoken.match(/\d{2,}/g) || []).sort((a, b) => b.length - a.length)
  if (nums.length) {
    if (nums.some((n) => item.includes(n))) return true
    // 접두 숫자만 일치 (P-160 vs 발화 160)
    if (prefix) {
      const pn = (prefix.match(/\d+/) || [])[0]
      if (pn && item.includes(pn) && nums.some((n) => n === pn || pn.includes(n) || n.includes(pn))) {
        return true
      }
    }
    return false
  }

  return true
}

function buildItemMismatchQuestion(spokenText, rejectedCode) {
  const snippet = String(spokenText || '').replace(/\s+/g, ' ').trim().slice(0, 48)
  const rejected = rejectedCode ? ` (방금 후보 ${rejectedCode}는 제외)` : ''
  return `품번을 정확히 못 들었습니다. "${snippet}" 중 어떤 품번을 확인할까요?${rejected}`
}

function isSpanishUtterance(text) {
  const s = String(text || '').trim()
  if (/[\u3131-\uD79D]/.test(s)) return false
  return /[a-záéíóúñ¿¡]/i.test(s)
}

function buildMultiCandidateQuestion(spokenCode, candidates, text) {
  const code = String(spokenCode || '').trim() || '해당'
  const list = (Array.isArray(candidates) ? candidates : []).slice(0, 5)
  const count = Array.isArray(candidates) ? candidates.length : list.length
  const listed = list.length ? list.join(', ') : ''
  const isEs = isSpanishUtterance(text)

  // 1단계: 10개 초과 대량 후보 (예: '60' -> 88개)
  if (count > 10) {
    if (isEs) {
      return `Hay ${count} productos con "${code}". Son demasiados. Por favor, diga el código completo con letras o modelo.`
    }
    return `"${code}" 포함 상품이 ${count}가지로 너무 많습니다. 영문자(예: P, L 등)나 규격을 함께 말씀해 주세요.`
  }

  // 2단계: 6~10개 중규모 후보 (예: '3331' 6개)
  // 단, 모든 후보가 SURTIDO(혼색)뿐인지 확인
  const allSurtido =
    Array.isArray(candidates) &&
    candidates.length > 0 &&
    candidates.every((i) => /SURTIDO/i.test(String(i)))
  if (count > 5) {
    if (isEs) {
      return allSurtido
        ? `Hay ${count} productos surtidos para "${code}". Por favor, dígame la cantidad de empaque o número.`
        : `Hay ${count} productos para "${code}". Por favor, dígame el color o la cantidad de empaque.`
    }
    return allSurtido
      ? `"${code}" 기본 색상(SURTIDO) 상품이 ${count}가지 있습니다. 포장개수나 세부 번호를 말씀해 주세요.`
      : `"${code}" 검색 결과가 ${count}가지 있습니다. 색상이나 포장개수를 말씀해 주세요.`
  }

  // 3단계: 2~5개 소수 정밀 후보 (예: '160' -> P-160, L-PL160)
  if (isEs) {
    return listed
      ? `Hay ${count} productos para "${code}": ${listed}. ¿Cuál desea consultar?`
      : `Hay ${count} productos relacionados con "${code}". Digame el color o la cantidad de empaque.`
  }
  return listed
    ? `"${code}" 관련 상품이 ${count}가지 있습니다. 예: ${listed}. 어떤 상품을 조회할까요?`
    : `"${code}" 관련 상품이 ${count}가지 있습니다. 색상이나 포장개수를 말씀해 주세요.`
}

/** 품번 가족 키: P-160-REY-300 → P-160, L-OP80-NEGRO-12 → L-OP80, 3331-SURTIDO-200 → 3331 */
function itemFamilyKey(itemCode) {
  const u = String(itemCode || '').toUpperCase()
  const letter = u.match(/^([A-Z]+-[A-Z0-9]+)/)
  if (letter) return letter[1]
  const num = u.match(/^(\d+)/)
  if (num) return num[1]
  return u
}

function candidatesShareSingleFamily(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return false
  const keys = new Set(candidates.map(itemFamilyKey).filter(Boolean))
  return keys.size === 1
}

/**
 * 발화에 품목/수량 신호가 있는지 (창고 후속과 구분)
 */
function hasItemLikeSignal(text) {
  const raw = String(text || '').trim()
  if (!raw) return false
  if (/^[A-Za-z]{1,3}-?\d+/.test(raw)) return true
  if (/(불또|bulto|박스|담아|넣어|추가|재고|검색|품명|장바구니)/i.test(raw)) return true
  if (hasStrongItemIdentity(raw)) return true
  const { prefix } = normalizeSpokenQuery(raw, '')
  return !!prefix
}

/**
 * 관리자 창고 재질문 후속: 창고명만 말한 경우에만 lastIntent 품목 유지
 * (품목+창고 한 문장은 Gemini raw를 덮어쓰지 않음)
 */
function applyWarehouseFollowUp(parsed, lastIntent) {
  if (!parsed || !lastIntent?.item) return parsed
  if (!['search', 'none'].includes(parsed.intent)) return parsed
  if (lastIntent.intent !== 'search') return parsed

  const raw = String(parsed.raw_spoken_item || parsed.spoken_text || '').trim()
  const wh = String(parsed.warehouse || '').trim()

  // 신규 품목 신호가 raw에 있으면 후속 보정 금지
  if (raw && !looksLikeWarehouseUtterance(raw) && hasItemLikeSignal(raw)) {
    return parsed
  }

  const warehouseOnly =
    looksLikeWarehouseUtterance(raw) ||
    (wh &&
      looksLikeWarehouseUtterance(wh) &&
      (!raw || raw === lastIntent.item || looksLikeWarehouseUtterance(raw)))

  if (!warehouseOnly) return parsed

  const hint = wh || raw
  if (!hint) return parsed

  parsed.warehouse = wh || hint
  parsed.intent = 'search'
  parsed.item = lastIntent.item
  parsed._warehouseHint = String(parsed.warehouse).trim()
  parsed.raw_spoken_item = lastIntent.item
  return parsed
}

function matchItemCode(rawSpoken, color, validItems) {
  if (!rawSpoken) return null
  if (!validItems || validItems.length === 0) return null

  // 창고명만 들어온 경우 품목 매칭하지 않음
  if (looksLikeWarehouseUtterance(rawSpoken)) return null

  const raw = spokenNumeralsToDigits(String(rawSpoken).trim())
  // 메모리/정식코드 정확 일치
  const exact =
    validItems.find((i) => i === raw) ||
    validItems.find((i) => String(i).toUpperCase() === raw.toUpperCase())
  if (exact) return exact

  // 발화 내 단어 중 정확히 일치하는 품번이 있는지 먼저 검사 (예: "3331 알라르꼰 창고..." 중 "3331")
  const tokens = raw.split(/\s+/)
  for (const token of tokens) {
    const cleanToken = token.replace(/[^A-Za-z0-9-]/g, '')
    if (cleanToken.length >= 2) {
      const found =
        validItems.find((i) => i === cleanToken) ||
        validItems.find((i) => String(i).toUpperCase() === cleanToken.toUpperCase())
      if (found) return found
    }
  }

  const { prefix, color: col, flexQuery } = normalizeSpokenQuery(raw, color, validItems)

  // 1) 접두 매칭 (P-160 → P-160-* / 3331 → 3331-*)
  if (prefix) {
    const upper = prefix.toUpperCase()
    let hits = validItems.filter(
      (i) => {
        const u = String(i).toUpperCase()
        if (u === upper || u.startsWith(`${upper}-`)) return true
        if (/^\d+$/.test(upper)) {
          const numRegex = new RegExp(`(^|[^0-9])${upper}([^0-9]|$)`, 'i')
          return numRegex.test(u)
        }
        return false
      }
    )
    if (col) {
      const colored = hits.filter((i) => String(i).toUpperCase().includes(col))
      if (colored.length) hits = colored
    }
    if (hits.length === 1) return hits[0]
    // 여러 후보는 임의 확정하지 않음 (다중 후보 역질문이 처리)
    if (hits.length > 1) return null
  }

  // 2) FlexSearch 보조 (영문/숫자 쿼리일 때 유효)
  initFlexSearch(validItems)
  if (!flexIndex) return null
  const results = flexIndex.search(flexQuery || raw, 5)
  const ids = results?.[0]?.result || []
  if (!ids.length) return null
  let hits = ids.map((id) => validItems[id]).filter(Boolean)
  if (col) {
    const colored = hits.filter((i) => String(i).toUpperCase().includes(col))
    if (colored.length) hits = colored
  }
  if (hits.length === 1) return hits[0]
  if (hits.length > 1) return null
  return null
}

/**
 * 색상/포장단위 지정 없이 단축번호(예: "3331") 조회 시 여러 파생 상품이 있는지 검사하는 함수
 */
function findMatchingCandidates(rawSpoken, color, validItems) {
  if (!validItems || !validItems.length) return []
  if (looksLikeWarehouseUtterance(rawSpoken)) return []
  const raw = spokenNumeralsToDigits(String(rawSpoken || '').trim())
  const { prefix, color: col } = normalizeSpokenQuery(raw, color, validItems)
  if (!prefix) return []
  const upper = prefix.toUpperCase()
  let hits = validItems.filter((i) => {
    const u = String(i).toUpperCase()
    if (u === upper || u.startsWith(`${upper}-`)) return true
    if (/^\d+$/.test(upper)) {
      const numRegex = new RegExp(`(^|[^0-9])${upper}([^0-9]|$)`, 'i')
      return numRegex.test(u)
    }
    return false
  })
  if (col) {
    const colored = hits.filter((i) => String(i).toUpperCase().includes(col))
    if (colored.length) hits = colored
  }
  // 사용자가 포장수량/서브번호 등 추가 숫자나 단서(예: '200', '-1')를 말했으면 필터링.
  // 부분문자열이 아니라 하이픈 구분 세그먼트로 비교해야 '1'이 '3331'에 걸리지 않는다.
  const nums = (raw.match(/\d+/g) || []).filter((n) => n !== upper.replace(/[^0-9]/g, ''))
  if (nums.length && hits.length > 1) {
    const numFiltered = hits.filter((i) => {
      const u = String(i).toUpperCase()
      return nums.some((num) => new RegExp(`(^|-)${num}(-|$)`).test(u))
    })
    if (numFiltered.length) hits = numFiltered
  }
  return hits
}

/**
 * Tier 2 후보 압축: 정규화된 발음 기준으로 유사 코드만 모음 (무관한 앞 N개 패딩 금지)
 */
function selectCandidatesForGemini(rawSpoken, color, validItems, max = 60) {
  if (!validItems || !validItems.length) return []
  if (validItems.length <= max) return validItems

  const raw = String(rawSpoken || '').trim()
  const { prefix, color: col, flexQuery } = normalizeSpokenQuery(raw, color, validItems)
  const candidateSet = new Set()
  const add = (item) => {
    if (!item || candidateSet.size >= max) return
    candidateSet.add(item)
  }

  // 1) 정규화 접두 가족 (P-160 → P-160-*)
  if (prefix) {
    const upper = prefix.toUpperCase()
    for (const item of validItems) {
      if (candidateSet.size >= max) break
      const u = String(item).toUpperCase()
      if (u === upper || u.startsWith(`${upper}-`)) add(item)
    }
  }

  // 2) FlexSearch (정규화 쿼리 우선)
  initFlexSearch(validItems)
  if (flexIndex) {
    const q = flexQuery || prefix || raw
    const results = flexIndex.search(q, 30)
    const ids = results?.[0]?.result || []
    ids.forEach((id) => add(validItems[id]))
  }

  // 3) 숫자 부분일치 (한글→숫자 변환 결과 포함). 단일 문자 접두(P/B)만으로 전체 쓸어담지 않음
  const numStr =
    (prefix && (prefix.match(/\d+/) || [])[0]) ||
    (raw.match(/\d+/) || [])[0] ||
    ''
  if (numStr) {
    for (const item of validItems) {
      if (candidateSet.size >= max) break
      const u = String(item).toUpperCase()
      if (!u.includes(numStr)) continue
      if (col && !u.includes(col)) {
        // 색 힌트가 있으면 숫자+색 우선, 여유 있을 때만 숫자만
        continue
      }
      add(item)
    }
    // 색 필터로 비었으면 숫자만이라도
    if (col && candidateSet.size < 5) {
      for (const item of validItems) {
        if (candidateSet.size >= max) break
        if (String(item).includes(numStr)) add(item)
      }
    }
  }

  return Array.from(candidateSet).slice(0, max)
}

/**
 * Tier 2: 압축 후보만 Gemini에 넘겨 정밀 코드 판별
 */
async function resolveItemCodeWithGemini(rawSpoken, color, validItems) {
  if (looksLikeWarehouseUtterance(rawSpoken)) return null

  const candidates = selectCandidatesForGemini(rawSpoken, color, validItems, 60)
  if (!candidates.length) return null

  const prompt = `You are a strict WMS Item Code Resolver (Hybrid RAG Tier 2).
User voice/text input: "${rawSpoken}" ${color ? `(Color hint: "${color}")` : ''}

Below is the list of existing valid item codes in our WMS database:
${JSON.stringify(candidates)}

Which EXACT item code from the array above best corresponds to what the user said?
Rules:
1. Return ONLY a valid JSON object: {"matched_code": "EXACT_ITEM_CODE"}
2. If none of the item codes correspond, return {"matched_code": null}
3. No markdown formatting, no explanations.`

  try {
    const response = await axios.post(
      GEMINI_API_URL,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.1
        }
      }
    )

    const partText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!partText) return null
    const responseText = partText.replace(/```json/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(responseText)
    const code = parsed?.matched_code
    if (!code) return null

    return (
      validItems.find((i) => i === code) ||
      validItems.find((i) => String(i).toUpperCase() === String(code).toUpperCase()) ||
      null
    )
  } catch (err) {
    console.warn('Tier 2 Gemini Item Resolver fallback warning:', err?.message || err)
  }
  return null
}

/**
 * Two-Tier Hybrid RAG
 * Tier1 로컬 → 실패 시에만 Tier2 (창고/스킵 옵션 시 Tier2 생략)
 */
async function matchItemCodeHybrid(rawSpoken, color, validItems, options = {}) {
  if (!rawSpoken || !validItems || !validItems.length) return null
  if (looksLikeWarehouseUtterance(rawSpoken)) return null

  const localMatch = matchItemCode(rawSpoken, color, validItems)
  if (localMatch) return localMatch
  if (options.skipTier2) return null

  return resolveItemCodeWithGemini(rawSpoken, color, validItems)
}

/** search/add_order 만 품목 코드 해석 필요 */
function shouldResolveItemCode(intent) {
  return intent === 'search' || intent === 'add_order'
}

async function attachResolvedItem(parsed, validItems, lastIntent) {
  // 창고 follow-up이 raw를 덮기 전에, 사용자가 실제로 말한 품번 신호 보존
  const spokenGuard = String(parsed.spoken_text || parsed.raw_spoken_item || '').trim()
  const strongSpoken = hasStrongItemIdentity(spokenGuard)

  // 단축번호 역질문 후속: "네그로"/"200"만 말하면 pending short code와 결합
  if (
    lastIntent?._pendingShortCode &&
    parsed.raw_spoken_item &&
    shouldResolveItemCode(parsed.intent)
  ) {
    const raw = String(parsed.raw_spoken_item).trim()
    const pending = String(lastIntent._pendingShortCode).trim()
    const alreadyHasPending =
      raw.toUpperCase().includes(pending.toUpperCase()) ||
      new RegExp(`\\b${pending}\\b`, 'i').test(raw)
    if (!alreadyHasPending && (!hasStrongItemIdentity(raw) || !/\d{3,}/.test(raw))) {
      parsed.raw_spoken_item = `${pending} ${raw}`.trim()
      if (parsed.spoken_text) {
        parsed.spoken_text = `${pending} ${parsed.spoken_text}`.trim()
      }
    }
  }

  applyWarehouseFollowUp(parsed, lastIntent)

  // (0) 동일 품번 하위 다중 후보군 역질문 엔진 (Multi-Candidate Clarification Engine)
  const targetSpoken = String(parsed.raw_spoken_item || spokenGuard || '').trim()
  if (targetSpoken && shouldResolveItemCode(parsed.intent) && !looksLikeWarehouseUtterance(targetSpoken)) {
    const multiCandidates = findMatchingCandidates(targetSpoken, parsed.color, validItems)
    if (multiCandidates.length > 1) {
      const exactSingle = multiCandidates.find((c) => String(c).toUpperCase() === targetSpoken.toUpperCase())
      if (!exactSingle) {
        // [SURTIDO 디폴트] 후보>5, 색상 미지정, SURTIDO 유일, 그리고 모든 후보가 동일 품번 가족일 때만
        // (예: P-160-* 만) — "160"처럼 P-160 + L-PL160 혼재 시에는 자동 확정하지 않음
        if (!parsed.color && multiCandidates.length > 5) {
          const surtidoHits = multiCandidates.filter((c) => /SURTIDO/i.test(String(c)))
          if (surtidoHits.length === 1 && candidatesShareSingleFamily(multiCandidates)) {
            parsed.item = surtidoHits[0]
            parsed.intent = 'search'
            return parsed
          }
        }
        const { prefix } = normalizeSpokenQuery(targetSpoken, parsed.color, validItems)
        const numOrCode = prefix || (targetSpoken.match(/[A-Za-z0-9-]+/) || [targetSpoken])[0]
        parsed.intent = 'ask_clarification'
        parsed.question = buildMultiCandidateQuestion(numOrCode, multiCandidates, spokenGuard || targetSpoken)
        parsed._ambiguousCandidates = multiCandidates.slice(0, 5)
        parsed._pendingShortCode = numOrCode
        parsed.item = undefined
        parsed.raw_spoken_item = String(numOrCode)
        return parsed
      }
    }
  }

  if (parsed.raw_spoken_item && shouldResolveItemCode(parsed.intent)) {
    const matched = await matchItemCodeHybrid(parsed.raw_spoken_item, parsed.color, validItems, {
      skipTier2: looksLikeWarehouseUtterance(parsed.raw_spoken_item)
    })
    let item = matched || parsed.item || undefined
    if (!item && /^[A-Za-z]{1,3}-?\d+/.test(String(parsed.raw_spoken_item).trim())) {
      item = String(parsed.raw_spoken_item).trim()
    }

    // 발화 품번 신호 ≠ 매칭 결과 → 잘못된 확정 응답 차단
    const guardForMismatch = String(parsed.spoken_text || spokenGuard || parsed.raw_spoken_item || '').trim()
    if (item && hasStrongItemIdentity(guardForMismatch) && !itemMatchesSpokenIdentity(item, guardForMismatch)) {
      parsed.intent = 'ask_clarification'
      parsed.question = buildItemMismatchQuestion(guardForMismatch, item)
      parsed._rejectedMatch = item
      parsed.item = undefined
      parsed.raw_spoken_item = guardForMismatch
      return parsed
    }
    parsed.item = item
    if (item) parsed._pendingShortCode = undefined
  }

  // Gemini/메모리가 이미 item을 넣은 경우도 동일 검증
  if (
    parsed.item &&
    strongSpoken &&
    shouldResolveItemCode(parsed.intent) &&
    !itemMatchesSpokenIdentity(parsed.item, spokenGuard)
  ) {
    parsed.intent = 'ask_clarification'
    parsed.question = buildItemMismatchQuestion(spokenGuard, parsed.item)
    parsed._rejectedMatch = parsed.item
    parsed.item = undefined
    parsed.raw_spoken_item = spokenGuard
    return parsed
  }

  // 창고만 말한 후속("알라르꼰")일 때만 직전 품목 채움.
  // 품번을 말했는데 해석에 실패한 경우까지 채우면 엉뚱한 품목의 재고를 읽어준다.
  const followUpGuard = String(parsed.spoken_text || spokenGuard || '').trim()
  const unresolvedCodeSignal = /\d{2,}/.test(spokenNumeralsToDigits(followUpGuard))
  if (
    !parsed.item &&
    parsed.warehouse &&
    lastIntent?.item &&
    !strongSpoken &&
    !unresolvedCodeSignal
  ) {
    parsed.item = lastIntent.item
  }
  return parsed
}

// SamdoriBrain.js
// Handles NLP via Backend Proxy (/api/ai/gemini) for the Samdori Voice Assistant

const GEMINI_API_URL = '/api/ai/gemini';

/**
 * Sends transcribed text to Gemini API to extract intent.
 * 
 * Intents:
 * - search: { intent: 'search', item: 'P-160' }
 * - add_order: { intent: 'add_order', item: 'P-160', color: 'NEGRO', qty: 2 }
 * - check: { intent: 'check' }
 * - submit: { intent: 'submit' }
 * 
 * @param {string} text - User's voice transcribed text
 * @returns {Promise<Object>} - The parsed intent object
 */

/**
 * [대화 캐시 / 역질문 엔진용 컨텍스트 프롬프트 빌더]
 * 최근 최대 4턴(메시지 8개)의 대화 맥락과 품목 캐시를 전달
 */
function buildContextPrompt(lastIntent) {
  if (!lastIntent) return ''
  const item = lastIntent.item || ''
  const pendingShort = lastIntent._pendingShortCode || ''
  const history = Array.isArray(lastIntent.sessionHistory) ? lastIntent.sessionHistory : []

  let prompt = ''
  if (pendingShort && !item) {
    const candidates = Array.isArray(lastIntent._ambiguousCandidates)
      ? lastIntent._ambiguousCandidates.slice(0, 5).join(', ')
      : ''
    prompt += `
PENDING SHORT CODE CLARIFICATION:
The user previously searched incomplete code "${pendingShort}" and was asked to pick color/pack size.
${candidates ? `Candidate SKUs: ${candidates}` : ''}
If the current utterance is ONLY a color, pack size, or sub-code (e.g. "네그로", "200", "SURTIDO", "negro"),
set raw_spoken_item to combine them, e.g. "${pendingShort} 네그로" or "${pendingShort}-200".
Do NOT fall back to an unrelated older item from memory.
`
  }
  if (item) {
    const lastAction = lastIntent.intent || 'unknown'
    prompt += `
CONVERSATION CONTEXT (MEMORY) — CRITICAL FOR 2-STEP FLOW:
The user recently used item: "${item}" (last intent: "${lastAction}").
Typical warehouse flow with Push-To-Talk (two separate button presses):
  1) search/품명검색 for a product
  2) then add N boxes(불또) to cart WITHOUT repeating the full item code

When the current command is ONLY about quantity + cart verbs (담아/넣어/추가/불또/박스) and does NOT clearly name a different item code,
you MUST set raw_spoken_item="${item}".

Treat ALL of the following as referring to "${item}":
- Pronouns: "이거", "이것", "그거", "그것", "얘", "this", "that", "eso", "este", "esta"
- Recall: "아까", "방금", "이전", "조회했던", "조회한", "검색한", "확인한", "품명검색한", "그 제품", "그 품목", "아까 거", "방금 본 거"
- Spanish: "el de antes", "el que busqué", "ese producto", "el anterior", "el mismo"
- Even SHORT commands with NO item noun: "두 불또 담아줘", "한박스 넣어줘", "3불또 추가해", "장바구니에 두 개 넣어"
- Affirmative answers after a clarification question ("응", "맞아", "네", "sí", "correcto", "eso") usually confirm "${item}".

Examples that MUST resolve raw_spoken_item to "${item}":
- "두 불또 장바구니에 넣어줘" -> {"intent":"add_order","raw_spoken_item":"${item}","qty":2}
- "한불또 담아줘" -> {"intent":"add_order","raw_spoken_item":"${item}","qty":1}
- "3박스 추가해" -> {"intent":"add_order","raw_spoken_item":"${item}","qty":3}
- "그거 재고 다시" -> {"intent":"search","raw_spoken_item":"${item}"}

WAREHOUSE FOLLOW-UP (admin often asked "which warehouse?"):
If the user answers with ONLY a warehouse/branch name (no new item code), return:
{"intent":"search","raw_spoken_item":"${item}","warehouse":"<name>"}
Examples: "알라르꼰", "까르멘", "Alarcón", "Carmen", "본사", "지점" -> search same item + warehouse.

Only ignore this memory if the user clearly names a DIFFERENT explicit item code in the current command.

CRITICAL RULE FOR NUMERIC AND SHORT CODES (e.g., "3331", "3358", "4308", "7001", "160", "P-160"):
If the user's current command mentions ANY 2+ digit number, DO NOT copy "${item}" from memory!! You MUST extract that number as the NEW "raw_spoken_item" (e.g. "raw_spoken_item": "3331"). A 4-digit number is an item code, NOT just a quantity!
This applies EQUALLY when the digits are spoken in Korean instead of written as numerals. Convert them to Arabic numerals in "raw_spoken_item":
- Digit-by-digit reading: "삼삼삼일" -> "3331", "사삼공팔" -> "4308", "삼삼오팔" -> "3358"
- Sino-Korean numbers: "삼천삼백삼십일" -> "3331", "칠천일" -> "7001", "백육십" -> "160"
- With a sub-code: "삼삼삼일-일" -> "3331-1", "삼삼삼일 다시 일" -> "3331-1"
Example: "삼삼삼일-일 알라르꼰 창고에 재고가 얼마나 있는가" -> {"intent":"search","raw_spoken_item":"3331-1","warehouse":"ALARCON"} — NEVER "${item}".
`
  }

  if (history.length > 0) {
    const lines = history.map((h, i) => {
      const role = String(h?.role || 'unknown').toUpperCase()
      const body =
        h?.text ||
        JSON.stringify({
          intent: h?.intent,
          item: h?.item,
          warehouse: h?.warehouse,
          qty: h?.qty,
          question: h?.question
        })
      return `${i + 1}. [${role}] ${body}`
    })
    prompt += `
RECENT CONVERSATION HISTORY (SESSION CACHE - MAX 4 TURNS / 8 MESSAGES):
${lines.join('\n')}

CLARIFICATION QUESTION ENGINE (REVERSE QUESTION):
- Use this history to resolve pronouns ("아까 거", "그거", "방금 본 거") when possible WITHOUT asking again.
- Prefer search/add_order/check/submit when the intent is reasonably clear from memory + current utterance.
- Use ask_clarification ONLY when there are genuinely conflicting candidates (e.g. two different items in history and the user says only "그거") OR required fields are missing and cannot be inferred.
- Do NOT ask clarification for clear warehouse-only answers, clear item codes, or clear qty+cart commands with memory item.
`
  }

  return prompt
}

export async function parseIntent(text, validItems = [], lastIntent = null) {
  const contextPrompt = buildContextPrompt(lastIntent)

  const promptCore = `
You are an AI Voice Assistant for a Warehouse Management System (WMS). Your name is 'Samdori' (in Korean) or 'Paquito' (in Spanish).
Your job is to analyze the user's voice command and extract the intent and parameters as a strict JSON object.
Do not output anything other than the JSON object.
${contextPrompt}
Supported intents:
1. "search": Product / stock lookup (품명검색, 재고조회).
   Treat ALL of these as "search":
   - "품명검색", "품명 검색", "검색해줘", "찾아줘", "조회해줘", "재고 확인", "재고조회", "몇 개야", "몇개나 있어"
   - Spanish: "Busca", "Inventario", "Stock de"
   Examples: "품명검색 P-160", "P-160 검색", "P-160 검정 재고 확인해줘", "Busca P-160 negro"
   Required fields: "intent": "search", "raw_spoken_item": "<what_the_user_said>"
   Optional fields: "warehouse": "<warehouse_name>" (e.g. "알라르꼰" -> "ALARCON", "까르멘" -> "CARMEN")
   - CRITICAL: Whenever the user mentions any warehouse or branch name in the command (e.g. "P-160 검정 알라르꼰 창고에 몇 개 있지?", "Alarcón stock de P-160"), you MUST extract that warehouse into the "warehouse" field! Never omit it!
   Optional fields: "color": "<color>" (UPPERCASE Spanish if possible)
   
2. "add_order": ONE unified action = add item into the shopping cart (장바구니 담기).
   Treat ALL of these as the SAME intent "add_order":
   - "장바구니에 담아/넣어/추가해", "카트에 넣어", "주문에 추가", "담아줘", "넣어줘", "추가해줘", "담아", "넣어", "추가"
   - Spanish: "agrega", "añade", "pon en el carrito", "agregar al carrito"
   Examples:
   - "P-160 검정 두 박스 장바구니에 담아" -> add_order qty=2
   - "두 불또 추가해줘" (with memory item) -> add_order that memory item, qty=2
   Required fields: "intent": "add_order", "raw_spoken_item": "<what_the_user_said>", "qty": <number>
   Optional fields: "color": "<color>"
   Note: Translate color to UPPERCASE SPANISH if possible (e.g. "검정색" -> "NEGRO", "하얀색" -> "BLANCO", "빨간색" -> "ROJO").
   If qty is missing, default qty to 1.
   qty means NUMBER OF BOXES (불또/박스), NOT eaches, unless the user clearly says 낱개/개/pieza.
   
3. "check": Checking what is ALREADY in the cart (장바구니 조회). NOT adding.
   Treat ALL of these as "check":
   - "장바구니 확인해줘", "장바구니 조회", "카트 확인해", "뭐 담겨 있어?", "뭐 들어있어?", "주문 리스트 확인해줘", "리스트 보여줘"
   - Spanish: "Revisa el carrito", "Revisa la lista", "Qué hay en el carrito?"
   Required fields: "intent": "check"
   
4. "submit": Submitting / transmitting the cart order to Frappe (ERP).
   Treat ALL of these as the SAME intent "submit":
   - "주문 전송", "전송해줘", "전송", "올려줘", "발주 올려", "프라페 전송", "Frappe 전송", "ERP 전송", "제출해줘", "보내줘"
   - STT mishears: "청송", "전송해", "프라빼 전송", "푸라페 전송" → still "submit"
   - Spanish: "Enviar pedido", "Envía el pedido", "Manda el pedido", "Confirma el pedido"
   Required fields: "intent": "submit"

5. "none": If the user's command is just meaningless background noise, incomplete chatter, or lacks any clear WMS action (e.g. check, add, submit, search), DO NOT force an intent. Simply output {"intent": "none"}

6. "ask_clarification": Reverse Question Engine (의도 확정 역질문 엔진) — USE SPARINGLY
   - ONLY when the command is truly ambiguous AND memory/history cannot resolve it (conflicting items, missing required target).
   - Prefer search/add_order/check/submit whenever reasonably clear.
   - Do NOT use for clear warehouse-only replies, clear item codes, or qty+cart with a known memory item.
   - Required fields: "intent": "ask_clarification", "question": "<short clarification question in Korean or Spanish matching the user's language>"
   - Examples:
     * Korean: "지점장님, 아까 조회하신 P-160 검정색 말씀이신가요?"
     * Spanish: "¿Se refiere a P-160 NEGRO de antes?"
     * Unclear warehouse: "어느 창고(알라르꼰/까르멘) 재고로 확인해 드릴까요?"
   - If you cannot form a question, output {"intent":"none"} instead.

CRITICAL RULE FOR raw_spoken_item:
You NO LONGER need to output a valid full item code. Simply extract exactly what the user sounded out phonetically for the item name (e.g. "피 백육십", "P 160", "P-160").
The frontend will handle searching the actual database.
  NUMBERS MUST BE ARABIC NUMERALS. If the user reads an item number in Korean, convert it: "삼삼삼일" -> "3331", "삼천삼백삼십일" -> "3331", "사삼공팔" -> "4308", "삼삼삼일-일" -> "3331-1", "백육십" -> "160". Keep a spoken alphabet prefix as spoken ("피 백육십" -> "피 160").
  Also note that users might mix Korean and Spanish (e.g., "P-160 네그로", where '네그로' is Negro). Understand that '네그로' means 'black' or 'NEGRO'.
  CRITICAL: The word "불또" (or "bulto", "불도", "불독", "불꽃") is a Kopanish/Spanish keyword meaning "Box" (박스). 
  When users say "<number>불또" (e.g., "한불또", "1불또", "두불또", "세불또", "un bulto", "이불또"), you must carefully extract the exact number as "qty". 
  Korean counters: 한/일/하나=1, 두/이/둘=2, 세/삼/셋=3, 네/사/넷=4, 다섯/오=5. (e.g., "한불또" means qty: 1. "두불또" means qty: 2).
`
  
  const prompt = promptCore + `

User's Command: "${text}"
`;
try {
    const response = await axios.post(GEMINI_API_URL, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        response_mime_type: "application/json",
      }
    });

    const partText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!partText) {
      throw new Error('Gemini returned empty candidates (blocked or no content).');
    }
    let responseText = partText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(responseText);
    
// Add token usage metadata
    if (response.data.usageMetadata) {
      parsed._tokenUsage = response.data.usageMetadata;
    }
    
    // 창고 후속 보정 → search/add_order 만 Two-Tier 품목 매칭
    await attachResolvedItem(parsed, validItems, lastIntent)
    
    return parsed;
  } catch (error) {
    console.error('Samdori Brain Error:', error);
    throw error;
  }
}

/**
 * Sends audio data to Gemini API to extract intent (Multimodal).
 */
export async function parseIntentFromAudio(base64Audio, mimeType, validItems = [], lastIntent = null) {
  const contextPrompt = buildContextPrompt(lastIntent)

  const promptCore = `
You are an AI Voice Assistant for a Warehouse Management System (WMS). Your name is 'Samdori' (in Korean) or 'Paquito' (in Spanish).
Your job is to analyze the user's voice command and extract the intent and parameters as a strict JSON object.
Do not output anything other than the JSON object.
${contextPrompt}
Supported intents:
1. "search": Product / stock lookup (품명검색, 재고조회).
   Treat ALL of these as "search":
   - "품명검색", "품명 검색", "검색해줘", "찾아줘", "조회해줘", "재고 확인", "재고조회", "몇 개야", "몇개나 있어"
   - Spanish: "Busca", "Inventario", "Stock de"
   Examples: "품명검색 P-160", "P-160 검색", "P-160 검정 재고 확인해줘", "Busca P-160 negro"
   Required fields: "intent": "search", "raw_spoken_item": "<what_the_user_said>"
   Optional fields: "warehouse": "<warehouse_name>" (e.g. "알라르꼰" -> "ALARCON", "까르멘" -> "CARMEN")
   - CRITICAL: Whenever the user mentions any warehouse or branch name in the command (e.g. "P-160 검정 알라르꼰 창고에 몇 개 있지?", "Alarcón stock de P-160"), you MUST extract that warehouse into the "warehouse" field! Never omit it!
   Optional fields: "color": "<color>" (UPPERCASE Spanish if possible)
   
2. "add_order": ONE unified action = add item into the shopping cart (장바구니 담기).
   Treat ALL of these as the SAME intent "add_order":
   - "장바구니에 담아/넣어/추가해", "카트에 넣어", "주문에 추가", "담아줘", "넣어줘", "추가해줘", "담아", "넣어", "추가"
   - Spanish: "agrega", "añade", "pon en el carrito", "agregar al carrito"
   Examples:
   - "P-160 검정 두 박스 장바구니에 담아" -> add_order qty=2
   - "두 불또 추가해줘" (with memory item) -> add_order that memory item, qty=2
   Required fields: "intent": "add_order", "raw_spoken_item": "<what_the_user_said>", "qty": <number>
   Optional fields: "color": "<color>"
   Note: Translate color to UPPERCASE SPANISH if possible (e.g. "검정색" -> "NEGRO", "하얀색" -> "BLANCO", "빨간색" -> "ROJO").
   If qty is missing, default qty to 1.
   qty means NUMBER OF BOXES (불또/박스), NOT eaches, unless the user clearly says 낱개/개/pieza.
   
3. "check": Checking what is ALREADY in the cart (장바구니 조회). NOT adding.
   Treat ALL of these as "check":
   - "장바구니 확인해줘", "장바구니 조회", "카트 확인해", "뭐 담겨 있어?", "뭐 들어있어?", "주문 리스트 확인해줘", "리스트 보여줘"
   - Spanish: "Revisa el carrito", "Revisa la lista", "Qué hay en el carrito?"
   Required fields: "intent": "check"
   
4. "submit": Submitting / transmitting the cart order to Frappe (ERP).
   Treat ALL of these as the SAME intent "submit":
   - "주문 전송", "전송해줘", "전송", "올려줘", "발주 올려", "프라페 전송", "Frappe 전송", "ERP 전송", "제출해줘", "보내줘"
   - STT mishears: "청송", "전송해", "프라빼 전송", "푸라페 전송" → still "submit"
   - Spanish: "Enviar pedido", "Envía el pedido", "Manda el pedido", "Confirma el pedido"
   Required fields: "intent": "submit"

5. "none": If the user's command is just meaningless background noise, incomplete chatter, or lacks any clear WMS action (e.g. check, add, submit, search), DO NOT force an intent. Simply output {"intent": "none"}

6. "ask_clarification": Reverse Question Engine (의도 확정 역질문 엔진) — USE SPARINGLY
   - ONLY when the command is truly ambiguous AND memory/history cannot resolve it (conflicting items, missing required target).
   - Prefer search/add_order/check/submit whenever reasonably clear.
   - Do NOT use for clear warehouse-only replies, clear item codes, or qty+cart with a known memory item.
   - Required fields: "intent": "ask_clarification", "question": "<short clarification question in Korean or Spanish matching the user's language>"
   - Examples:
     * Korean: "지점장님, 아까 조회하신 P-160 검정색 말씀이신가요?"
     * Spanish: "¿Se refiere a P-160 NEGRO de antes?"
     * Unclear warehouse: "어느 창고(알라르꼰/까르멘) 재고로 확인해 드릴까요?"
   - If you cannot form a question, output {"intent":"none"} instead.

CRITICAL RULE FOR raw_spoken_item:
You NO LONGER need to output a valid full item code. Simply extract exactly what the user sounded out phonetically for the item name (e.g. "피 백육십", "P 160", "P-160").
The frontend will handle searching the actual database.
  NUMBERS MUST BE ARABIC NUMERALS. If the user reads an item number in Korean, convert it: "삼삼삼일" -> "3331", "삼천삼백삼십일" -> "3331", "사삼공팔" -> "4308", "삼삼삼일-일" -> "3331-1", "백육십" -> "160". Keep a spoken alphabet prefix as spoken ("피 백육십" -> "피 160").
  Also note that users might mix Korean and Spanish (e.g., "P-160 네그로", where '네그로' is Negro). Understand that '네그로' means 'black' or 'NEGRO'.
  CRITICAL: The word "불또" (or "bulto", "불도", "불독", "불꽃") is a Kopanish/Spanish keyword meaning "Box" (박스). 
  When users say "<number>불또" (e.g., "한불또", "1불또", "두불또", "세불또", "un bulto", "이불또"), you must carefully extract the exact number as "qty". 
  Korean counters: 한/일/하나=1, 두/이/둘=2, 세/삼/셋=3, 네/사/넷=4, 다섯/오=5. (e.g., "한불또" means qty: 1. "두불또" means qty: 2).
`
  
  const prompt = promptCore + `

The user's command is provided as the attached audio file.
Always include "spoken_text": a short transcript of what was said (for cancel/repeat local handling).
In "spoken_text", write every number as Arabic numerals, never as Korean numeral words ("삼삼삼일-일 알라르꼰 창고" -> "3331-1 알라르꼰 창고").
`;
try {
    const response = await axios.post(GEMINI_API_URL, {
      contents: [{
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Audio
            }
          }
        ]
      }],
      generationConfig: {
        response_mime_type: "application/json",
      }
    });

    const partText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!partText) {
      throw new Error('Gemini audio returned empty candidates (blocked, unsupported mime, or no content).');
    }
    let responseText = partText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(responseText);
    
// Add token usage metadata
    if (response.data.usageMetadata) {
      parsed._tokenUsage = response.data.usageMetadata;
    }
    
    // 창고 후속 보정 → search/add_order 만 Two-Tier 품목 매칭
    await attachResolvedItem(parsed, validItems, lastIntent)
    
    return parsed;
  } catch (error) {
    console.error('Samdori Brain Audio Error:', error);
    throw error;
  }
}

export const _testExports = {
  normalizeSpokenQuery,
  findMatchingCandidates,
  buildMultiCandidateQuestion,
  attachResolvedItem,
  parseKoreanNumberChunk,
  spokenNumeralsToDigits,
  hasStrongItemIdentity,
  itemMatchesSpokenIdentity
}

