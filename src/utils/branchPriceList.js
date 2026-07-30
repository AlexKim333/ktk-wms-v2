/**
 * 지점 단가표(Price List) 온더플라이 생성 + Item Price Upsert.
 *
 * 이 모듈이 해결하는 두 가지 실패:
 * 1) 지점용 단가표 마스터가 없어 Item Price 생성이 Link 검증에서 거부되는 문제
 *    → 저장 시점에 단가표를 자동 생성(Auto-Provisioning)한다.
 * 2) 이미 같은 (item_code, price_list) 조합이 있는데 POST 를 보내 중복 오류(417)가 나는 문제
 *    → 쓰기 직전에 정확히 일치하는 레코드를 재조회해 있으면 PUT, 없으면 POST 한다.
 */

import { frappeErrorMessage } from './frappeError.js'

const BASE_PRICE_LIST = 'Standard Selling'

/** 오류의 HTTP 상태코드를 진단용으로 노출한다. 403(권한)과 417(검증)을 구분하는 데 필요하다. */
const statusOf = (error) => error?.response?.status || '?'

/** 지점명으로 대상 단가표 이름을 만든다. 저장/조회가 같은 규칙을 쓰도록 여기 한 곳에서만 정의한다. */
export function branchPriceListName(branchName) {
  return branchName ? `${BASE_PRICE_LIST} - ${branchName}` : BASE_PRICE_LIST
}

/**
 * 창고 Full Name("K3 - K")에서 회사 약칭 suffix를 떼어낸 짧은 지점명("K3").
 * 로그인 지점(branch_name)은 Warehouse 링크라 회사 약칭이 붙지만,
 * 단가표는 짧은 이름("Standard Selling - K3")으로 만들어지므로 조회 시 둘 다 시도해야 한다.
 */
export function branchShortName(branchName) {
  const s = String(branchName || '').trim()
  if (!s) return ''
  return s.replace(/\s+-\s+[A-Za-z0-9]{1,5}$/, '').trim()
}

/**
 * 조회 시 시도할 지점 단가표 후보 목록 (중복 제거, 본사 단가표 제외).
 * 예: branchName 이 "K3 - K" 이면 ["Standard Selling - K3 - K", "Standard Selling - K3"]
 */
export function branchPriceListCandidates(branchName) {
  const out = []
  const full = branchPriceListName(branchName)
  if (full !== BASE_PRICE_LIST) out.push(full)
  const short = branchShortName(branchName)
  const shortList = branchPriceListName(short)
  if (short && short !== String(branchName || '').trim() && shortList !== BASE_PRICE_LIST && !out.includes(shortList)) {
    out.push(shortList)
  }
  return out
}

/** 기준 단가표에서 통화를 물려받는다. 지점 단가표가 본사와 다른 통화로 생기는 것을 막기 위함. */
async function resolveCurrency(frappeApi) {
  try {
    const res = await frappeApi.get(`/api/resource/Price List/${encodeURIComponent(BASE_PRICE_LIST)}`, {
      params: { fields: JSON.stringify(['currency']) }
    })
    const currency = res.data?.data?.currency
    if (currency) return currency
  } catch (e) {
    console.warn('기준 단가표 통화 조회 실패, 기본값으로 진행합니다.', e?.response?.status || e)
  }
  return 'USD'
}

// 그리드 패밀리 일괄 저장처럼 한 번에 수십 건을 쓸 때 같은 단가표를 반복 조회하지 않기 위한 세션 캐시
const verifiedPriceLists = new Set()

// 같은 세션에서 이미 실패한 생성을 반복 시도해 콘솔을 더럽히지 않기 위한 기록
const failedPriceLists = new Map()

/**
 * 단가표 존재 여부를 확인한다.
 * @returns {Promise<{state: 'exists'|'missing'|'unknown', error?: any}>}
 *   unknown 은 '없다' 가 아니라 '알 수 없다' 는 뜻이다. 읽기 권한이 없으면 존재해도 403 이 온다.
 */
async function checkPriceList(frappeApi, priceListName) {
  try {
    await frappeApi.get(`/api/resource/Price List/${encodeURIComponent(priceListName)}`, {
      params: { fields: JSON.stringify(['name']) }
    })
    return { state: 'exists' }
  } catch (e) {
    if (e?.response?.status === 404) return { state: 'missing' }
    return { state: 'unknown', error: e }
  }
}

/**
 * 단가표가 없으면 즉시 생성한다.
 * @returns {Promise<{ok: boolean, created: boolean, reason?: string, error?: any}>}
 */
export async function ensureBranchPriceList(frappeApi, branchName) {
  return ensurePriceListByName(frappeApi, branchPriceListName(branchName))
}

/** 단가표 Full Name 기준으로 없으면 즉시 생성한다. */
export async function ensurePriceListByName(frappeApi, priceListName) {
  if (verifiedPriceLists.has(priceListName)) return { ok: true, created: false }

  const previousFailure = failedPriceLists.get(priceListName)
  if (previousFailure) return previousFailure

  const checked = await checkPriceList(frappeApi, priceListName)

  if (checked.state === 'exists') {
    verifiedPriceLists.add(priceListName)
    return { ok: true, created: false }
  }

  // 읽기가 막혀 있어도 생성 권한은 따로 열려 있을 수 있으므로 생성은 시도한다.
  try {
    await frappeApi.post('/api/resource/Price List', {
      price_list_name: priceListName,
      selling: 1,
      buying: 0,
      enabled: 1,
      currency: await resolveCurrency(frappeApi)
    })
    verifiedPriceLists.add(priceListName)
    return { ok: true, created: true }
  } catch (createErr) {
    // Frappe 는 중복을 409 로도 417 로도 돌려주므로 상태코드로 단정하지 않고 실제 존재 여부를 확인한다.
    if ((await checkPriceList(frappeApi, priceListName)).state === 'exists') {
      verifiedPriceLists.add(priceListName)
      return { ok: true, created: false }
    }
    console.error(`단가표 ${priceListName} 자동 생성 실패:`, createErr)
    const failure = {
      ok: false,
      created: false,
      reason: createErr?.response?.status === 403 ? 'forbidden' : 'create_failed',
      error: createErr,
      readError: checked.error
    }
    failedPriceLists.set(priceListName, failure)
    return failure
  }
}

/** (item_code, price_list) 로 정확히 일치하는 Item Price 의 name 을 찾는다. 없으면 null. */
export async function findItemPriceName(frappeApi, itemCode, priceListName) {
  try {
    const res = await frappeApi.get('/api/resource/Item Price', {
      params: {
        filters: JSON.stringify([
          ['item_code', '=', itemCode],
          ['price_list', '=', priceListName]
        ]),
        fields: JSON.stringify(['name']),
        limit_page_length: 1
      }
    })
    return res.data?.data?.[0]?.name || null
  } catch (e) {
    console.warn('기존 Item Price 조회 실패:', e?.response?.status || e)
    return null
  }
}

/**
 * 지점 Item Price 를 Upsert 한다. 단가표가 없으면 먼저 만든다.
 * @param {object} payload price_list_rate 및 custom_tier_*_price 등 저장할 필드
 * @param {string|null} knownName 화면이 이미 알고 있는 레코드 name (있으면 조회를 한 번 줄인다)
 * @returns {Promise<string|null>} 저장된 레코드의 name
 */
export async function upsertBranchItemPrice(frappeApi, { branchName, itemCode, payload, knownName = null }) {
  if (!itemCode || !frappeApi) return null

  // 창고 Full Name("K3 - K")과 짧은 이름("K3") 두 형태의 단가표가 현장 데이터에 혼재한다.
  // 기존 레코드는 후보 전부에서 찾고, 신규 생성은 실제 존재하는 단가표에 붙인다.
  const candidates = branchPriceListCandidates(branchName)
  const namesToTry = candidates.length ? candidates : [branchPriceListName(branchName)]

  // 화면이 들고 있는 name 이 낡았을 수 있으므로 쓰기 직전에 서버 기준으로 다시 확인한다.
  let existingName = null
  for (const plName of namesToTry) {
    existingName = await findItemPriceName(frappeApi, itemCode, plName)
    if (existingName) break
  }
  existingName = existingName || knownName

  if (existingName) {
    await frappeApi.put(`/api/resource/Item Price/${encodeURIComponent(existingName)}`, payload)
    return existingName
  }

  // 신규 생성 대상 단가표: 후보 중 실제 존재하는 것을 우선 사용 (중복 단가표 생성 방지)
  let priceListName = namesToTry[0]
  for (const plName of namesToTry) {
    if ((await checkPriceList(frappeApi, plName)).state === 'exists') {
      priceListName = plName
      break
    }
  }
  const ensured = await ensurePriceListByName(frappeApi, priceListName)

  // 단가표 확인/생성은 어디까지나 보조 단계다.
  // 지점 계정은 Price List 를 읽을 권한조차 없을 수 있는데, 그렇다고 단가표가 없다는 뜻은 아니다.
  // 따라서 확인이 실패해도 생성은 시도하고, 진짜 판정은 아래 POST 결과에 맡긴다.
  try {
    const created = await frappeApi.post('/api/resource/Item Price', {
      item_code: itemCode,
      price_list: priceListName,
      ...payload
    })
    return created.data?.data?.name || null
  } catch (postErr) {
    // 저장이 실패했고 단가표 확보도 못 했다면, 그 사실을 원인 후보로 함께 알려준다.
    if (!ensured.ok) {
      const hint =
        ensured.reason === 'forbidden'
          ? `단가표 "${priceListName}" 를 만들 권한이 없습니다.\nFrappe 역할 권한에서 Price List 도스타입에 Create 를 허용해야 합니다.`
          : `단가표 "${priceListName}" 자동 생성에 실패했습니다.`
      const createDetail = `\n[생성 오류 ${statusOf(ensured.error)}] ${frappeErrorMessage(ensured.error)}`
      const readDetail = ensured.readError
        ? `\n[조회 오류 ${statusOf(ensured.readError)}] ${frappeErrorMessage(ensured.readError)}`
        : ''
      throw new Error(`${frappeErrorMessage(postErr)}\n\n${hint}${createDetail}${readDetail}`)
    }
    throw postErr
  }
}
