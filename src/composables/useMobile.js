import { ref, onMounted, onUnmounted } from 'vue'

export function useMobile() {
  // 초기 false면 모바일 UI가 뜬 뒤에도 ref 연결 전에 데스크톱 장바구니로 빠질 수 있음
  const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth <= 768 : false)

  const checkMobile = () => {
    isMobile.value = window.innerWidth <= 768
  }

  onMounted(() => {
    checkMobile()
    window.addEventListener('resize', checkMobile)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', checkMobile)
  })

  return { isMobile }
}
