import { ref } from 'vue'
import axios from 'axios'

const frappeApi = axios.create({
  headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
  withCredentials: true
})

export function usePendingReservations() {
  const pendingReservedMap = ref({})

  const fetchPendingReservations = async () => {
    try {
      const [reqRes, reqDraftRes] = await Promise.all([
        frappeApi.get('/api/resource/Material Request', {
          params: {
            fields: JSON.stringify(['name']),
            filters: JSON.stringify([['docstatus', '=', 1], ['status', 'in', ['Pending', 'Draft', 'Partially Ordered', 'Partially Issued', 'Partially Received', 'Partial']]]),
            limit_page_length: 0
          }
        }).catch(() => ({ data: { data: [] } })),
        frappeApi.get('/api/resource/Material Request', {
          params: {
            fields: JSON.stringify(['name']),
            filters: JSON.stringify([['docstatus', '=', 0], ['custom_approval_stage', '=', '지점장 승인']]),
            limit_page_length: 0
          }
        }).catch(() => ({ data: { data: [] } }))
      ]);

      const reqList = [...(reqRes.data?.data || []), ...(reqDraftRes.data?.data || [])];
      const reservedMap = {};

      if (reqList.length > 0) {
        const mrDetailsPromises = reqList.map(req =>
          frappeApi.get(`/api/resource/Material Request/${req.name}`).catch(() => null)
        );
        const mrDetailsRes = (await Promise.all(mrDetailsPromises)).filter(Boolean);

        mrDetailsRes.forEach(res => {
          const doc = res.data?.data;
          if (!doc) return;

          let sourceWh = null;
          if (doc.material_request_type === 'Material Issue') {
            sourceWh = doc.set_warehouse;
          } else if (doc.material_request_type === 'Material Transfer') {
            sourceWh = doc.set_from_warehouse;
          }
            
          if (!sourceWh) return;

          if (!reservedMap[sourceWh]) reservedMap[sourceWh] = {};

          doc.items.forEach(item => {
             const fulfilledQty = Number(item.ordered_qty || item.received_qty || item.issued_qty || 0);
             const rem = item.qty - fulfilledQty;
             if (rem > 0) {
                let itemWh = sourceWh;
                if (doc.material_request_type === 'Material Issue') {
                  itemWh = item.warehouse || sourceWh;
                } else if (doc.material_request_type === 'Material Transfer') {
                  itemWh = item.s_warehouse || item.from_warehouse || sourceWh;
                }

                if (!reservedMap[itemWh]) reservedMap[itemWh] = {};
                reservedMap[itemWh][item.item_code] = (reservedMap[itemWh][item.item_code] || 0) + rem;
             }
          });
        });
      }
      
      pendingReservedMap.value = reservedMap;
      return reservedMap;
    } catch (err) {
      console.error('Failed to fetch pending reservations:', err)
      return {}
    }
  }

  const getAvailableStock = (itemCode, warehouse, totalActualQty = 0) => {
    let totalReserved = 0;
    if (warehouse) {
      totalReserved = pendingReservedMap.value[warehouse]?.[itemCode] || 0;
    } else {
      for (const wh in pendingReservedMap.value) {
        totalReserved += pendingReservedMap.value[wh]?.[itemCode] || 0;
      }
    }
    return totalActualQty - totalReserved;
  }

  return {
    pendingReservedMap,
    fetchPendingReservations,
    getAvailableStock
  }
}
