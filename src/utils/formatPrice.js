/** POS 금액 표기: 소수점 2자리 고정 (MXN) */
export const formatPrice = (val) => {
  return Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default formatPrice
