// src/composables/usePriceTierEngine.js
// 지점별 4단계 수량구간, 스마트 BOX 수량 동적 보정, 0값 예비 구간 자동 스킵을 담당하는 공통 엔진
//
// 구간 수는 백엔드(Item Price)에 실제로 존재하는 단가 필드에 맞춰 4단계로 고정한다.
// 1구간 = price_list_rate, 2~4구간 = custom_tier_2~4_price.
// 여기서 없는 필드를 추가하면 Frappe 목록 조회가 통째로 417 로 거부되므로 임의로 늘리면 안 된다.

import { upsertBranchItemPrice } from '../utils/branchPriceList.js'

/** 백엔드 단가 필드에 대응하는 수량구간 개수 */
export const TIER_COUNT = 4

/**
 * 지점 전역 수량구간(4단계) 기본 설정 가져오기
 */
export function getBranchGlobalTiers(branchName) {
  try {
    const key = branchName ? `branch_price_tiers_${branchName}_v1` : 'branch_price_tiers_v1'
    let saved = localStorage.getItem(key)
    if (!saved && branchName) {
      saved = localStorage.getItem('branch_price_tiers_v1')
    }
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        // 5구간 시절에 저장된 설정이 남아 있을 수 있으므로 현재 구간 수로 잘라서 쓴다.
        return parsed.slice(0, TIER_COUNT)
      }
    }
  } catch (e) {
    console.warn('Error reading branch_price_tiers_v1:', e)
  }

  // 기본값 4구간 (0 입력 시 예비 구간)
  return [
    { minQty: 1, label: '1구간 (단품)', desc: '1개 이상 소량/단품 판매 단가' },
    { minQty: 10, label: '2구간 (소팩)', desc: '10개 이상 소팩 할인 단가' },
    { minQty: 50, label: '3구간 (중팩)', desc: '50개 이상 중팩 할인 단가' },
    { minQty: 100, label: '4구간 (박스)', desc: '100개 이상 박스 할인 단가' }
  ]
}

/**
 * 특정 지점의 품목 개별 수량구간 설정(Override) 로드
 */
export function getBranchItemOverride(branchName, itemCode) {
  if (!branchName || !itemCode) return null
  try {
    const key = `branch_override_item_${branchName}_${itemCode}`
    const saved = localStorage.getItem(key)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (e) {
    console.warn('Error reading branch_override_item:', e)
  }
  return null
}

/**
 * 특정 지점의 품목 개별 수량구간 설정(Override) 저장
 */
export function saveBranchItemOverride(branchName, itemCode, overrideData) {
  if (!branchName || !itemCode) return
  try {
    const key = `branch_override_item_${branchName}_${itemCode}`
    localStorage.setItem(key, JSON.stringify(overrideData))
  } catch (e) {
    console.warn('Error saving branch_override_item:', e)
  }
}

/**
 * 품목에 적용할 최종 5단계 수량구간 결정 (스마트 BOX 수량 엔진 적용)
 * 
 * 1우선순위: 품목 개별 수량구간 Override가 활성화된 경우
 * 2우선순위: 지점 전역 수량구간 + 스마트 BOX 수량(pack_qty) 동적 보정
 * 공통 규칙: 수량이 0 이하인 예비 구간은 제외/스킵 가능
 */
export function resolveItemTiers(branchName, item) {
  if (!item) return []

  const itemCode = item.item_code || item.name
  const packQty = Number(item.custom_pack_qty || item.pack_qty || 0)
  const override = getBranchItemOverride(branchName, itemCode)

  // 1우선순위: 품목 개별 수량구간 사용
  if (override && override.useCustomOverride && Array.isArray(override.tiers)) {
    return override.tiers.slice(0, TIER_COUNT).map((t, idx) => ({
      tierIndex: idx + 1,
      minQty: Number(t.minQty || 0),
      label: t.label || `가격 ${idx + 1}`,
      // 사용자가 지점 설정에서 직접 붙인 라벨인지 여부. 뱃지 문구를 원본으로 보여줄지 판단하는 데만 쓴다.
      isCustomLabel: Boolean(t.label && String(t.label).trim()),
      isOverride: true,
      isSmartBox: false
    }))
  }

  // 2우선순위: 지점 전역 수량구간 + 스마트 BOX 수량(pack_qty) 동적 보정
  const globalTiers = getBranchGlobalTiers(branchName)
  return globalTiers.map((t, idx) => {
    let qty = Number(t.minQty || 0)
    let isSmartBox = false

    // 마지막 구간(박스)에 대해 품목 실제 포장단위(packQty)가 존재하면 동적 보정
    if (idx === globalTiers.length - 1 && packQty > 1) {
      qty = packQty
      isSmartBox = true
    } else if (packQty > 1 && qty >= packQty) {
      // 스마트 BOX 수량(packQty)보다 같거나 큰 중간 전역 구간(예: 3구간 100개 vs BOX 96개)은
      // 박스 구간과 역전되거나 충돌하지 않도록 자동으로 예비/비활성(0) 처리
      qty = 0
    }

    return {
      tierIndex: idx + 1,
      minQty: qty,
      label: t.label || `가격 ${idx + 1}`,
      isCustomLabel: Boolean(t.label && String(t.label).trim()),
      isOverride: false,
      isSmartBox
    }
  })
}

/**
 * 수량구간 번호를 언어 중립 코드값으로 변환한다.
 * 화면 표시 문구는 i18n 키(branch.pos.tier_badge_*)로 뽑고, 분기 판별은 이 코드값으로만 한다.
 * 1구간(기본가)은 'base' 로 두어 할인 뱃지 노출 대상에서 제외한다.
 */
export function getTierCode(tierIndex) {
  const idx = Number(tierIndex || 1)
  if (!(idx > 1)) return 'base'
  // 단가표가 4구간까지만 있으므로 표시용 코드도 그 범위로 묶는다. (없는 i18n 키 참조 방지)
  return `tier${Math.min(idx, TIER_COUNT)}`
}

/**
 * 판매 수량(qty)에 해당하는 적용 단가 구간 계산
 * 
 * @param {number} qty - 장바구니 상품 수량
 * @param {object} itemPrice - 단가표 객체 (price_list_rate, custom_tier_2_price, ...)
 * @param {Array} resolvedTiers - resolveItemTiers로 결정된 4단계 구간 리스트
 */
export function calculateTierPrice(qty, itemPrice, resolvedTiers) {
  // tierLabel 은 기존 로직 호환용으로 계속 채운다. 신규 분기는 tierCode / tierIndex 를 쓴다.
  if (!itemPrice) return { price: 0, tierIndex: 1, tierCode: 'base', tierLabel: '단품 기본가', isCustomLabel: false }

  const targetQty = Number(qty || 1)

  // 단가 매핑 테이블
  const priceValues = {
    1: Number(itemPrice.price_list_rate || 0),
    2: Number(itemPrice.custom_tier_2_price || 0),
    3: Number(itemPrice.custom_tier_3_price || 0),
    4: Number(itemPrice.custom_tier_4_price || 0)
  }

  // 유효한 수량(> 0)이 설정된 구간만 내림차순 정렬하여 가장 높은 해당 수량구간 매칭
  const validTiers = (resolvedTiers || [])
    .filter(t => t.minQty > 0 && priceValues[t.tierIndex] > 0)
    .sort((a, b) => b.minQty - a.minQty)

  for (const tier of validTiers) {
    if (targetQty >= tier.minQty) {
      return {
        price: priceValues[tier.tierIndex],
        tierIndex: tier.tierIndex,
        tierCode: getTierCode(tier.tierIndex),
        tierLabel: tier.label,
        isCustomLabel: Boolean(tier.isCustomLabel),
        minQty: tier.minQty,
        isSmartBox: tier.isSmartBox
      }
    }
  }

  // 매칭되는 구간이 없거나 1구간
  return {
    price: priceValues[1] || 0,
    tierIndex: 1,
    tierCode: 'base',
    tierLabel: '1구간 기본가',
    isCustomLabel: false,
    minQty: 1,
    isSmartBox: false
  }
}

/**
 * 스캔한 바코드에 매칭되는 수량구간의 기본 수량(minQty) 반환
 * 예: 팩 바코드(2구간) 스캔 시 10개, BOX 바코드(4구간) 스캔 시 96개 자동 추가
 */
export function getBarcodeScanQty(code, item, resolvedTiers) {
  if (!code || !item || !Array.isArray(resolvedTiers)) return 1

  const upperCode = String(code).trim().toLowerCase()
  const getMinQtyOfTier = (idx) => {
    const t = resolvedTiers.find(r => r.tierIndex === idx)
    return (t && t.minQty > 0) ? Number(t.minQty) : 1
  }

  // 1. 4구간 바코드(BOX) 일치 여부
  if (item.custom_tier_4_barcode && String(item.custom_tier_4_barcode).trim().toLowerCase() === upperCode) {
    return getMinQtyOfTier(4)
  }
  // 2. 3구간 바코드 일치 여부
  if (item.custom_tier_3_barcode && String(item.custom_tier_3_barcode).trim().toLowerCase() === upperCode) {
    return getMinQtyOfTier(3)
  }
  // 3. 2구간 바코드(소팩) 일치 여부
  if (item.custom_tier_2_barcode && String(item.custom_tier_2_barcode).trim().toLowerCase() === upperCode) {
    return getMinQtyOfTier(2)
  }

  // 4. 상품명이나 코드 접미사(-B, -BOX, -PACK 등)로 팩/박스 단위가 명시된 품목인 경우
  if (upperCode.endsWith('-b') || upperCode.endsWith('-box')) {
    const boxQty = getMinQtyOfTier(4)
    if (boxQty > 1) return boxQty
  }
  if (upperCode.endsWith('-p') || upperCode.endsWith('-pack')) {
    const packQty = getMinQtyOfTier(2)
    if (packQty > 1) return packQty
  }

  // 기본 단품 수량 (1구간)
  return 1
}

/**
 * 품목의 그리드 그룹 ID 추출 (동일 스타일 컬러/사이즈 품목 식별)
 */
export function getItemGridGroupId(item) {
  if (!item) return null
  if (item.custom_grid_group_id && String(item.custom_grid_group_id).trim()) {
    return String(item.custom_grid_group_id).trim()
  }
  if (item.custom_is_grid_item === 1 || item.is_explicit_grid) {
    const name = String(item.item_name || item.name || '').trim()
    if (name.includes('-')) {
      const parts = name.split('-')
      if (parts.length >= 2) return parts.slice(0, 2).join('-').trim()
    }
    return name
  }
  return null
}

/**
 * 장바구니 전체를 순회하여 그리드 그룹별 수량을 합산하고,
 * 합산 수량에 따른 수량구간 할인 단가를 각 SKU 아이템에 일괄 부여
 */
export function recalculateCartTierPrices(cartItems, branchName) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) return

  const groupQtyMap = {}
  const groupCountMap = {}

  // 1차 순회: 그룹별 합산 수량 및 포함 상품 수 계산
  cartItems.forEach(cItem => {
    if (!cItem || !cItem.raw_item) return
    const groupId = getItemGridGroupId(cItem.raw_item)
    cItem._gridGroupId = groupId
    if (groupId) {
      groupQtyMap[groupId] = (groupQtyMap[groupId] || 0) + Number(cItem.qty || 0)
      groupCountMap[groupId] = (groupCountMap[groupId] || 0) + 1
    }
  })

  // 2차 순회: 단가 재계산 및 합산 혜택 배지 정보 갱신
  cartItems.forEach(cItem => {
    if (!cItem || !cItem.raw_item) return
    const groupId = cItem._gridGroupId
    const isGridBundled = Boolean(groupId && (groupCountMap[groupId] > 1 || cItem.raw_item.custom_is_grid_item === 1))
    const targetQty = isGridBundled ? (groupQtyMap[groupId] || cItem.qty) : Number(cItem.qty || 1)

    const resolved = resolveItemTiers(branchName, cItem.raw_item)
    const result = calculateTierPrice(targetQty, cItem.raw_item, resolved)

    if (result && result.price > 0) {
      cItem.price_list_rate = result.price
      cItem.tier_label = result.tierLabel
      cItem.tier_index = result.tierIndex || 1
      cItem.tier_code = result.tierCode || getTierCode(result.tierIndex)
      cItem.tier_label_is_custom = Boolean(result.isCustomLabel)
      cItem.is_smart_box = result.isSmartBox
      cItem.is_grid_bundled = isGridBundled
      cItem.grid_group_qty = isGridBundled ? targetQty : Number(cItem.qty || 1)
      cItem.grid_group_id = groupId || null
    }
  })
}

/**
 * 장바구니에서 사용자가 직접 판매가를 수정/입력 시, 현재 판매 수량이 속한 구간 가격으로 자동 학습
 */
export function learnTierPriceFromCart(cItem, branchName) {
  if (!cItem || !cItem.raw_item || !cItem.price_list_rate) return
  const newPrice = Number(cItem.price_list_rate || 0)
  if (newPrice <= 0) return

  const resolved = resolveItemTiers(branchName, cItem.raw_item)
  const targetQty = Number(cItem.grid_group_qty || cItem.qty || 1)
  const raw = cItem.raw_item

  // 현재 수량 targetQty가 어떤 수량구간에 속하는지 판별하여 raw_item 단가 자동 갱신.
  // 수량이 큰 구간부터 훑어 가장 먼저 걸리는 구간에 학습시킨다.
  const tierIdx =
    [...resolved]
      .filter(t => Number(t.minQty || 0) > 0)
      .sort((a, b) => b.minQty - a.minQty)
      .find(t => targetQty >= Number(t.minQty))?.tierIndex || 1

  if (tierIdx > 1) {
    raw[`custom_tier_${tierIdx}_price`] = newPrice
  } else {
    raw.price_list_rate = newPrice
  }

  cItem._learnedTierIndex = tierIdx
}

/**
 * 판매된 장바구니 아이템 중 1~4단계 단가 중 하나라도 0원(미정의)인 품목 필터링
 * 0.0001초 이내 인메모리 연산 (서버 부하 0)
 */
export function getIncompletePriceItems(cartItems) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) return []
  const seen = new Set()
  const incomplete = []

  for (const cItem of cartItems) {
    if (!cItem || !cItem.item_code) continue
    if (seen.has(cItem.item_code)) continue
    seen.add(cItem.item_code)

    const raw = cItem.raw_item || {}
    const p1 = Number(raw.price_list_rate || cItem.price_list_rate || 0)
    const p2 = Number(raw.custom_tier_2_price || 0)
    const p3 = Number(raw.custom_tier_3_price || 0)
    const p4 = Number(raw.custom_tier_4_price || 0)

    // 4단계 단가 중 하나라도 0이면 미완성 품목으로 분류
    if (p1 === 0 || p2 === 0 || p3 === 0 || p4 === 0) {
      incomplete.push({
        item_code: cItem.item_code,
        item_name: cItem.item_name || cItem.item_code,
        custom_pack_qty: raw.custom_pack_qty || 1,
        raw_item: raw,
        prices: [p1, p2, p3, p4],
        grid_group_id: getItemGridGroupId(raw)
      })
    }
  }
  return incomplete
}

/**
 * 특정 지점의 상품 단가(Item Price)를 저장하거나 신규 생성 (인메모리 raw_item도 실시간 갱신)
 */
export async function saveBranchItemPrice(branchName, itemCode, newPrices, frappeApi, rawItem = null) {
  if (!itemCode || !frappeApi) return false

  const payload = {
    price_list_rate: Number(newPrices.price_list_rate || 0),
    custom_tier_2_price: Number(newPrices.custom_tier_2_price || 0),
    custom_tier_3_price: Number(newPrices.custom_tier_3_price || 0),
    custom_tier_4_price: Number(newPrices.custom_tier_4_price || 0)
  }

  try {
    await upsertBranchItemPrice(frappeApi, { branchName, itemCode, payload })
    // 인메모리 raw_item 즉시 갱신 (현장 POS 세션 내 실시간 적용)
    if (rawItem) {
      rawItem.price_list_rate = payload.price_list_rate
      rawItem.custom_tier_2_price = payload.custom_tier_2_price
      rawItem.custom_tier_3_price = payload.custom_tier_3_price
      rawItem.custom_tier_4_price = payload.custom_tier_4_price
    }
    return true
  } catch (err) {
    console.error(`Failed to save Item Price for ${itemCode}:`, err)
    return false
  }
}

/**
 * 그리드 상품의 단가를 동일 패밀리 전체에 '최신 입력 최우선(Latest-Wins)'으로 덮어쓰기 전파
 */
export async function propagateGridPriceToFamily(branchName, gridGroupId, newPrices, frappeApi, rawItems) {
  if (!gridGroupId || !Array.isArray(rawItems)) return 0
  const familyItems = rawItems.filter(i => {
    const gid = getItemGridGroupId(i)
    return gid && gid === gridGroupId
  })

  let updateCount = 0
  for (const item of familyItems) {
    const success = await saveBranchItemPrice(branchName, item.name, newPrices, frappeApi, item)
    if (success) {
      updateCount++
    }
  }
  return updateCount
}



