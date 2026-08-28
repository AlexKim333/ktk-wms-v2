/**
 * 시재(캐시 드로어) 개장/마감 공용 헬퍼.
 *
 * POS Opening Entry / POS Closing Entry(ERPNext 표준 doctype)를 그대로 쓰되,
 * 이 앱은 ERPNext 표준 POS Awesome 화면이 아니라 일반 Sales Invoice(is_pos:1)를
 * 직접 REST로 발행하므로, "지금 열려있는 시프트가 무엇인지"와 "그 기간의 매출 집계"는
 * 여기서 직접 계산한다(ERPNext의 whitelisted 메서드에 의존하지 않음).
 */

/**
 * 현재 사용자+POS Profile 기준으로 아직 마감되지 않은 POS Opening Entry를 찾는다.
 * (BranchTransferReservationList.vue / BranchSalesHistoryList.vue가 이미 쓰는
 * "두 리스트를 조회해 클라이언트에서 교차대조" 패턴과 동일)
 * @returns {Promise<object|null>} 열려있는 Opening Entry 요약 doc, 없으면 null
 */
export async function findOpenShiftEntry(frappeApi, { user, posProfile }) {
  if (!user || !posProfile) return null

  const openingsRes = await frappeApi
    .get('/api/resource/POS Opening Entry', {
      params: {
        fields: JSON.stringify(['name', 'creation', 'period_start_date', 'posting_date', 'pos_profile', 'user', 'company']),
        filters: JSON.stringify([
          ['user', '=', user],
          ['pos_profile', '=', posProfile],
          ['docstatus', '=', 1]
        ]),
        order_by: 'period_start_date desc',
        limit_page_length: 20
      }
    })
    .catch(() => ({ data: { data: [] } }))

  const openings = openingsRes.data?.data || []
  if (openings.length === 0) return null

  const names = openings.map((o) => o.name)
  const closingsRes = await frappeApi
    .get('/api/resource/POS Closing Entry', {
      params: {
        fields: JSON.stringify(['pos_opening_entry']),
        filters: JSON.stringify([
          ['pos_opening_entry', 'in', names],
          ['docstatus', '=', 1]
        ]),
        limit_page_length: 0
      }
    })
    .catch(() => ({ data: { data: [] } }))

  const closedNames = new Set((closingsRes.data?.data || []).map((c) => c.pos_opening_entry))
  return openings.find((o) => !closedNames.has(o.name)) || null
}

/**
 * 사용자가 sinceDatetime 이후 발행한 POS 매출(is_pos:1, 환불 포함)을 결제수단별로 합산한다.
 * 환불 전표는 payments 금액이 음수라서 자연히 차감된다.
 * @returns {Promise<{ totals: Record<string, number>, invoices: Array }>}
 */
export async function aggregateShiftSales(frappeApi, { user, sinceDatetime }) {
  const totals = { Cash: 0, 'Credit Card': 0, 'Wire Transfer': 0 }
  if (!user || !sinceDatetime) return { totals, invoices: [] }

  const listRes = await frappeApi
    .get('/api/resource/Sales Invoice', {
      params: {
        fields: JSON.stringify(['name', 'posting_date', 'customer', 'grand_total', 'is_return']),
        filters: JSON.stringify([
          ['is_pos', '=', 1],
          ['docstatus', '=', 1],
          ['company', '=', 'kecon'],
          ['owner', '=', user],
          ['creation', '>=', sinceDatetime]
        ]),
        limit_page_length: 500,
        order_by: 'creation asc'
      }
    })
    .catch(() => ({ data: { data: [] } }))

  const invoices = listRes.data?.data || []
  if (invoices.length === 0) return { totals, invoices: [] }

  const detailDocs = await Promise.all(
    invoices.map((inv) => frappeApi.get(`/api/resource/Sales Invoice/${inv.name}`).catch(() => null))
  )

  detailDocs.forEach((res) => {
    const payments = res?.data?.data?.payments || []
    payments.forEach((p) => {
      if (totals[p.mode_of_payment] !== undefined) {
        totals[p.mode_of_payment] += Number(p.amount || 0)
      }
    })
  })

  return { totals, invoices }
}

export default { findOpenShiftEntry, aggregateShiftSales }
