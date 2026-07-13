import { Document } from 'flexsearch'
import { shallowRef } from 'vue'

/**
 * FlexSearch 기반 상품/그리드 검색 (프론트 전용, 백엔드 무수정)
 * - tokenize: 'full' → 접두뿐 아니라 중간/끝 부분 문자열도 매칭 (P-4D70 → D70, 70)
 * - 품목 검색 필드는 item_name(품명)만 사용
 *   ※ item_code(name)에 포장수량 접미사(-10 등)가 포함되어
 *     숫자 검색 시 포장수량처럼 매칭되는 부작용을 방지
 */

function createDocumentIndex(idField, indexFields) {
  return new Document({
    document: {
      id: idField,
      index: indexFields,
      store: false
    },
    tokenize: 'full', // 중간·끝 부분 문자열도 매칭 (예: P-4D70 → D70, 70)
    cache: true,
    optimize: true
  })
}

function createItemDocument() {
  return createDocumentIndex('name', ['item_name'])
}

function createGridDocument() {
  return createDocumentIndex('id', ['group_name', 'id'])
}

function toItemSearchDoc(item) {
  return {
    name: item.name,
    item_name: item.item_name || ''
  }
}

function flattenSearchIds(rawResults, limit) {
  const ids = []
  const seen = new Set()
  for (const fieldResult of rawResults) {
    for (const id of fieldResult.result || []) {
      if (seen.has(id)) continue
      seen.add(id)
      ids.push(id)
      if (limit != null && ids.length >= limit) return ids
    }
  }
  return ids
}

/**
 * 짧은 부분일치(예: 60)에서 P-160보다 P-D60이 위로 오도록 품명 매칭 점수 정렬
 */
export function rankItemNameMatches(items, query) {
  const q = (query || '').trim().toLowerCase()
  if (!q || !items?.length) return items || []

  const scored = items.map((item, idx) => ({
    item,
    idx,
    score: scoreItemNameMatch(item.item_name || '', q)
  }))
  scored.sort((a, b) => b.score - a.score || a.idx - b.idx)
  return scored.map((s) => s.item)
}

function scoreItemNameMatch(name, q) {
  const n = String(name).toLowerCase()
  if (!n.includes(q)) return 0
  if (n === q) return 1000

  let best = 100
  let from = 0
  while (from <= n.length) {
    const idx = n.indexOf(q, from)
    if (idx < 0) break
    const prev = idx > 0 ? n[idx - 1] : ''
    const next = idx + q.length < n.length ? n[idx + q.length] : ''

    if (n.endsWith(q) && idx === n.length - q.length) {
      if (!prev || /[^0-9]/.test(prev)) best = Math.max(best, 900)
      else best = Math.max(best, 250)
    } else if (prev && /[a-z-]/.test(prev) && (!next || /[^0-9]/.test(next))) {
      best = Math.max(best, 800) // D60, -60
    } else if (prev && /\d/.test(prev)) {
      best = Math.max(best, 150) // 160 안의 60
    } else {
      best = Math.max(best, 500)
    }
    from = idx + 1
  }
  return best
}

/**
 * 화면별 검색 필드가 다를 때 사용하는 독립 인덱서.
 * POS useItemSearch 와 상태를 공유하지 않음 (사이드 이펙트 방지).
 *
 * @param {{ idField?: string, indexFields: string[], toDoc: (item: object) => object }} options
 */
export function createFlexSearcher({ idField = 'name', indexFields, toDoc }) {
  let index = createDocumentIndex(idField, indexFields)
  const byId = shallowRef(new Map())

  function rebuild(items = []) {
    index = createDocumentIndex(idField, indexFields)
    const map = new Map()
    for (const item of items) {
      const doc = toDoc(item)
      const id = doc?.[idField]
      if (id == null || id === '') continue
      map.set(id, item)
      index.add(doc)
    }
    byId.value = map
  }

  function addOrUpdate(item) {
    const doc = toDoc(item)
    const id = doc?.[idField]
    if (id == null || id === '') return
    const map = new Map(byId.value)
    if (map.has(id)) index.update(doc)
    else index.add(doc)
    map.set(id, item)
    byId.value = map
  }

  function search(query, { limit = 50 } = {}) {
    const q = (query || '').trim()
    if (!q) return []
    const searchOpts = limit == null ? {} : { limit }
    const raw = index.search(q, searchOpts)
    const ids = flattenSearchIds(raw, limit)
    const map = byId.value
    return ids.map((id) => map.get(id)).filter(Boolean)
  }

  /** 빈 검색어: 목록 일부(또는 전체). 검색어 있음: 인덱스 검색 */
  function searchOrAll(query, { limit = 100, allLimit = null } = {}) {
    const q = (query || '').trim()
    if (!q) {
      const all = []
      for (const item of byId.value.values()) {
        all.push(item)
        if (allLimit != null && all.length >= allLimit) break
      }
      return all
    }
    return search(q, { limit: limit == null ? null : limit })
  }

  return { rebuild, addOrUpdate, search, searchOrAll, byId }
}

export function useItemSearch() {
  let itemIndex = createItemDocument()
  const itemById = shallowRef(new Map())

  let gridIndex = createGridDocument()
  const gridById = shallowRef(new Map())

  function rebuildItemIndex(items = []) {
    itemIndex = createItemDocument()
    const map = new Map()
    for (const item of items) {
      if (!item?.name) continue
      map.set(item.name, item)
      itemIndex.add(toItemSearchDoc(item))
    }
    itemById.value = map
  }

  function addOrUpdateItem(item) {
    if (!item?.name) return
    const map = new Map(itemById.value)
    const doc = toItemSearchDoc(item)
    if (map.has(item.name)) {
      itemIndex.update(doc)
    } else {
      itemIndex.add(doc)
    }
    map.set(item.name, item)
    itemById.value = map
  }

  function searchItems(query, { limit = 50 } = {}) {
    const q = (query || '').trim()
    if (!q) return []
    const raw = itemIndex.search(q, { limit })
    const ids = flattenSearchIds(raw, limit)
    const map = itemById.value
    return ids.map((id) => map.get(id)).filter(Boolean)
  }

  /** 슬롯 모달: 빈 검색어면 목록 일부 반환 */
  function searchItemsOrAll(query, { limit = 100, allLimit = 300 } = {}) {
    const q = (query || '').trim()
    if (!q) {
      const all = []
      for (const item of itemById.value.values()) {
        all.push(item)
        if (all.length >= allLimit) break
      }
      return all
    }
    return searchItems(q, { limit })
  }

  function rebuildGridIndex(groups = []) {
    gridIndex = createGridDocument()
    const map = new Map()
    for (const group of groups) {
      if (!group?.id) continue
      map.set(group.id, group)
      gridIndex.add({
        id: group.id,
        group_name: group.group_name || ''
      })
    }
    gridById.value = map
  }

  function searchGridsOrAll(query, { limit = 100, allLimit = 300 } = {}) {
    const q = (query || '').trim()
    if (!q) {
      const all = []
      for (const group of gridById.value.values()) {
        all.push(group)
        if (all.length >= allLimit) break
      }
      return all
    }
    const raw = gridIndex.search(q, { limit })
    const ids = flattenSearchIds(raw, limit)
    const map = gridById.value
    return ids.map((id) => map.get(id)).filter(Boolean)
  }

  return {
    rebuildItemIndex,
    addOrUpdateItem,
    searchItems,
    searchItemsOrAll,
    rebuildGridIndex,
    searchGridsOrAll
  }
}
