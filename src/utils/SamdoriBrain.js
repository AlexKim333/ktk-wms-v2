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

/** "백육십", "백 육십", "일백육십" → 160 */
function parseKoreanNumberChunk(text) {
  let t = String(text || '').replace(/\s+/g, '')
  if (!t) return ''
  if (/\d/.test(t)) {
    const m = t.match(/\d+/g)
    return m ? m.join('') : ''
  }
  let n = 0
  if (t.includes('백')) {
    const [a, b] = t.split('백')
    const hundreds = a === '' ? 1 : koDigit(a)
    if (hundreds == null) return ''
    n += hundreds * 100
    t = b || ''
  }
  if (t.includes('십')) {
    const [a, b] = t.split('십')
    const tens = a === '' ? 1 : koDigit(a)
    if (tens == null) return ''
    n += tens * 10
    t = b || ''
  }
  if (t) {
    const ones = koDigit(t)
    if (ones == null) return n ? String(n) : ''
    n += ones
  }
  return n ? String(n) : ''
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
function normalizeSpokenQuery(rawSpoken, color) {
  let s = String(rawSpoken || '').trim()
  const resolvedColor = resolveColorToken(color, s)

  // 이미 정식 코드면 그대로
  if (/^[A-Za-z]+-\d+/.test(s)) {
    const m = s.toUpperCase().match(/^([A-Z]+-\d+)/)
    return { prefix: m ? m[1] : s.toUpperCase(), color: resolvedColor, flexQuery: s.toUpperCase() }
  }

  // 접두 문자
  let letter = 'P'
  if (/^(비|비이|b\b)/i.test(s) || /^b/i.test(s.replace(/\s/g, ''))) letter = 'B'
  if (/^(피|프이|pee|p\b)/i.test(s) || /^p/i.test(s.replace(/\s/g, ''))) letter = 'P'
  const latin = s.match(/[A-Za-z]/)
  if (latin) letter = latin[0].toUpperCase()

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

  const prefix = num ? `${letter}-${num}` : ''
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
  const raw = String(text || '').trim()
  if (!raw || raw.length > 40) return false
  // 품목/담기/수량 신호가 있으면 창고 후속이 아님
  if (/(불또|bulto|박스|담아|넣어|추가|재고|검색|품명|피\s|전송|장바구니)/i.test(raw)) {
    return false
  }
  if (/^[A-Za-z]{1,3}-?\d+/.test(raw)) return false
  // STT 오인식 포함 (알라르꼰/까르멘 등)
  return /(알라르꼰|알라르콘|알라르권|알라르고|알라르|알라콘|알라꼰|alarcon|alarcón|본사|메인|main|본부|carmen|까르멘|카르멘|까르맨|카르맨|까르면|카르면|까멘|티엔다|tienda|tienda|polanco|폴랑코|insurgentes|satelite|satélite|queretaro|querétaro|창고|지점|sucursal|warehouse)/i.test(
    raw
  )
}

/**
 * 발화에 품목/수량 신호가 있는지 (창고 후속과 구분)
 */
function hasItemLikeSignal(text) {
  const raw = String(text || '').trim()
  if (!raw) return false
  if (/^[A-Za-z]{1,3}-?\d+/.test(raw)) return true
  if (/(불또|bulto|박스|담아|넣어|추가|재고|검색|품명|장바구니)/i.test(raw)) return true
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

  const raw = String(rawSpoken).trim()
  // 메모리/정식코드 정확 일치
  const exact =
    validItems.find((i) => i === raw) ||
    validItems.find((i) => String(i).toUpperCase() === raw.toUpperCase())
  if (exact) return exact

  const { prefix, color: col, flexQuery } = normalizeSpokenQuery(raw, color)

  // 1) 접두 매칭 (P-160 → P-160-*)
  if (prefix) {
    const upper = prefix.toUpperCase()
    let hits = validItems.filter(
      (i) => {
        const u = String(i).toUpperCase()
        return u === upper || u.startsWith(`${upper}-`)
      }
    )
    if (col) {
      const colored = hits.filter((i) => String(i).toUpperCase().includes(col))
      if (colored.length) hits = colored
    }
    if (hits.length === 1) return hits[0]
    if (hits.length > 1) {
      return hits.find((i) => /NEGRO/i.test(i)) || hits[0]
    }
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
  if (hits.length > 1) return hits.find((i) => /NEGRO/i.test(i)) || hits[0]
  return null
}

/**
 * Tier 2 후보 압축: 정규화된 발음 기준으로 유사 코드만 모음 (무관한 앞 N개 패딩 금지)
 */
function selectCandidatesForGemini(rawSpoken, color, validItems, max = 60) {
  if (!validItems || !validItems.length) return []
  if (validItems.length <= max) return validItems

  const raw = String(rawSpoken || '').trim()
  const { prefix, color: col, flexQuery } = normalizeSpokenQuery(raw, color)
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
  if (!GEMINI_API_KEY) return null
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
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
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
  applyWarehouseFollowUp(parsed, lastIntent)

  if (parsed.raw_spoken_item && shouldResolveItemCode(parsed.intent)) {
    const matched = await matchItemCodeHybrid(parsed.raw_spoken_item, parsed.color, validItems, {
      skipTier2: looksLikeWarehouseUtterance(parsed.raw_spoken_item)
    })
    parsed.item = matched || parsed.item || undefined
    if (!parsed.item && /^[A-Za-z]{1,3}-?\d+/.test(String(parsed.raw_spoken_item).trim())) {
      parsed.item = String(parsed.raw_spoken_item).trim()
    }
  }
  if (!parsed.item && parsed.warehouse && lastIntent?.item) {
    parsed.item = lastIntent.item
  }
  return parsed
}

// SamdoriBrain.js
// Handles NLP via Gemini API for the Samdori Voice Assistant

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent';

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
export async function parseIntent(text, validItems = [], lastIntent = null) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API Key is missing. Please check .env file.');
  }


  let contextPrompt = ''
  if (lastIntent && lastIntent.item) {
    const lastAction = lastIntent.intent || 'unknown'
    contextPrompt = `
CONVERSATION CONTEXT (MEMORY) — CRITICAL FOR 2-STEP FLOW:
The user recently used item: "${lastIntent.item}" (last intent: "${lastAction}").
Typical warehouse flow with Push-To-Talk (two separate button presses):
  1) search/품명검색 for a product
  2) then add N boxes(불또) to cart WITHOUT repeating the full item code

When the current command is ONLY about quantity + cart verbs (담아/넣어/추가/불또/박스) and does NOT clearly name a different item code,
you MUST set raw_spoken_item="${lastIntent.item}".

Treat ALL of the following as referring to "${lastIntent.item}":
- Pronouns: "이거", "이것", "그거", "그것", "얘", "this", "that", "eso", "este", "esta"
- Recall: "아까", "방금", "이전", "조회했던", "조회한", "검색한", "확인한", "품명검색한", "그 제품", "그 품목", "아까 거", "방금 본 거"
- Spanish: "el de antes", "el que busqué", "ese producto", "el anterior", "el mismo"
- Even SHORT commands with NO item noun: "두 불또 담아줘", "한박스 넣어줘", "3불또 추가해", "장바구니에 두 개 넣어"

Examples that MUST resolve raw_spoken_item to "${lastIntent.item}":
- "두 불또 장바구니에 넣어줘" -> {"intent":"add_order","raw_spoken_item":"${lastIntent.item}","qty":2}
- "한불또 담아줘" -> {"intent":"add_order","raw_spoken_item":"${lastIntent.item}","qty":1}
- "3박스 추가해" -> {"intent":"add_order","raw_spoken_item":"${lastIntent.item}","qty":3}
- "그거 재고 다시" -> {"intent":"search","raw_spoken_item":"${lastIntent.item}"}

WAREHOUSE FOLLOW-UP (admin often asked "which warehouse?"):
If the user answers with ONLY a warehouse/branch name (no new item code), return:
{"intent":"search","raw_spoken_item":"${lastIntent.item}","warehouse":"<name>"}
Examples: "알라르꼰", "까르멘", "Alarcón", "Carmen", "본사", "지점" -> search same item + warehouse.

Only ignore this memory if the user clearly names a DIFFERENT explicit item code in the current command.
`
  }

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

CRITICAL RULE FOR raw_spoken_item:
You NO LONGER need to output a valid full item code. Simply extract exactly what the user sounded out phonetically for the item name (e.g. "피 백육십", "P 160", "P-160").
The frontend will handle searching the actual database.
  Also note that users might mix Korean and Spanish (e.g., "P-160 네그로", where '네그로' is Negro). Understand that '네그로' means 'black' or 'NEGRO'.
  CRITICAL: The word "불또" (or "bulto", "불도", "불독", "불꽃") is a Kopanish/Spanish keyword meaning "Box" (박스). 
  When users say "<number>불또" (e.g., "한불또", "1불또", "두불또", "세불또", "un bulto", "이불또"), you must carefully extract the exact number as "qty". 
  Korean counters: 한/일/하나=1, 두/이/둘=2, 세/삼/셋=3, 네/사/넷=4, 다섯/오=5. (e.g., "한불또" means qty: 1. "두불또" means qty: 2).
`
  
  const prompt = promptCore + `

User's Command: "${text}"
`;
try {
    const response = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
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
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API Key is missing. Please check .env file.');
  }


  let contextPrompt = ''
  if (lastIntent && lastIntent.item) {
    const lastAction = lastIntent.intent || 'unknown'
    contextPrompt = `
CONVERSATION CONTEXT (MEMORY) — CRITICAL FOR 2-STEP FLOW:
The user recently used item: "${lastIntent.item}" (last intent: "${lastAction}").
Typical warehouse flow with Push-To-Talk (two separate button presses):
  1) search/품명검색 for a product
  2) then add N boxes(불또) to cart WITHOUT repeating the full item code

When the current command is ONLY about quantity + cart verbs (담아/넣어/추가/불또/박스) and does NOT clearly name a different item code,
you MUST set raw_spoken_item="${lastIntent.item}".

Treat ALL of the following as referring to "${lastIntent.item}":
- Pronouns: "이거", "이것", "그거", "그것", "얘", "this", "that", "eso", "este", "esta"
- Recall: "아까", "방금", "이전", "조회했던", "조회한", "검색한", "확인한", "품명검색한", "그 제품", "그 품목", "아까 거", "방금 본 거"
- Spanish: "el de antes", "el que busqué", "ese producto", "el anterior", "el mismo"
- Even SHORT commands with NO item noun: "두 불또 담아줘", "한박스 넣어줘", "3불또 추가해", "장바구니에 두 개 넣어"

Examples that MUST resolve raw_spoken_item to "${lastIntent.item}":
- "두 불또 장바구니에 넣어줘" -> {"intent":"add_order","raw_spoken_item":"${lastIntent.item}","qty":2}
- "한불또 담아줘" -> {"intent":"add_order","raw_spoken_item":"${lastIntent.item}","qty":1}
- "3박스 추가해" -> {"intent":"add_order","raw_spoken_item":"${lastIntent.item}","qty":3}
- "그거 재고 다시" -> {"intent":"search","raw_spoken_item":"${lastIntent.item}"}

WAREHOUSE FOLLOW-UP (admin often asked "which warehouse?"):
If the user answers with ONLY a warehouse/branch name (no new item code), return:
{"intent":"search","raw_spoken_item":"${lastIntent.item}","warehouse":"<name>"}
Examples: "알라르꼰", "까르멘", "Alarcón", "Carmen", "본사", "지점" -> search same item + warehouse.

Only ignore this memory if the user clearly names a DIFFERENT explicit item code in the current command.
`
  }

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

CRITICAL RULE FOR raw_spoken_item:
You NO LONGER need to output a valid full item code. Simply extract exactly what the user sounded out phonetically for the item name (e.g. "피 백육십", "P 160", "P-160").
The frontend will handle searching the actual database.
  Also note that users might mix Korean and Spanish (e.g., "P-160 네그로", where '네그로' is Negro). Understand that '네그로' means 'black' or 'NEGRO'.
  CRITICAL: The word "불또" (or "bulto", "불도", "불독", "불꽃") is a Kopanish/Spanish keyword meaning "Box" (박스). 
  When users say "<number>불또" (e.g., "한불또", "1불또", "두불또", "세불또", "un bulto", "이불또"), you must carefully extract the exact number as "qty". 
  Korean counters: 한/일/하나=1, 두/이/둘=2, 세/삼/셋=3, 네/사/넷=4, 다섯/오=5. (e.g., "한불또" means qty: 1. "두불또" means qty: 2).
`
  
  const prompt = promptCore + `

The user's command is provided as the attached audio file.
Always include "spoken_text": a short transcript of what was said (for cancel/repeat local handling).
`;
try {
    const response = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
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

