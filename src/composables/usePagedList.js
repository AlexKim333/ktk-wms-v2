import { ref, computed } from 'vue'

/**
 * 검색/목록 결과의 화면 렌더만 페이지네이션 (FlexSearch 속도 유지)
 * - 매칭은 전부 유지하고, DOM에는 pageSize씩만 그림
 * - 「결과 더보기」로 displayLimit 증가
 */
export function usePagedList(sourceComputed, pageSize = 50) {
  const displayLimit = ref(pageSize)

  const reset = () => {
    displayLimit.value = pageSize
  }

  const loadMore = () => {
    displayLimit.value += pageSize
  }

  const visible = computed(() => sourceComputed.value.slice(0, displayLimit.value))

  const hasMore = computed(() => sourceComputed.value.length > displayLimit.value)

  const remaining = computed(() =>
    Math.max(0, sourceComputed.value.length - displayLimit.value)
  )

  return {
    displayLimit,
    visible,
    hasMore,
    remaining,
    loadMore,
    reset,
    pageSize
  }
}
