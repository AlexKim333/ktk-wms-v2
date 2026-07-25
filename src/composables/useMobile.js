import { ref, onMounted, onUnmounted } from 'vue'

/** 폰 + 좁은 태블릿. 너무 낮으면 모바일 UI인데 PC 장바구니로 떨어지는 경우가 생김 */
const MOBILE_MAX_WIDTH = 1024

function computeIsMobile() {
  if (typeof window === 'undefined') return false
  const narrow = window.innerWidth <= MOBILE_MAX_WIDTH
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches
  return narrow || !!coarse
}

export function useMobile() {
  const isMobile = ref(computeIsMobile())

  const checkMobile = () => {
    isMobile.value = computeIsMobile()
  }

  onMounted(() => {
    checkMobile()
    window.addEventListener('resize', checkMobile)
    window.addEventListener('orientationchange', checkMobile)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', checkMobile)
    window.removeEventListener('orientationchange', checkMobile)
  })

  return { isMobile }
}
