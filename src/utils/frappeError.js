/**
 * Frappe 오류 응답에서 사람이 읽을 수 있는 메시지를 뽑아낸다.
 *
 * axios 의 error.message 는 'Request failed with status code 417' 처럼 원인을 알려주지 않는다.
 * 실제 사유는 응답 본문의 _server_messages / exception 안에 들어 있다.
 */
export function frappeErrorMessage(error) {
  const data = error?.response?.data
  const status = error?.response?.status

  // 1) _server_messages: JSON 문자열 배열 안에 다시 JSON 이 들어 있는 구조
  const raw = data?._server_messages
  if (raw) {
    try {
      const list = typeof raw === 'string' ? JSON.parse(raw) : raw
      const messages = (Array.isArray(list) ? list : [list])
        .map((entry) => {
          try {
            const parsed = typeof entry === 'string' ? JSON.parse(entry) : entry
            return parsed?.message || parsed
          } catch (_) {
            return entry
          }
        })
        .map((m) => stripHtml(String(m)))
        .filter(Boolean)
      if (messages.length) return messages.join('\n')
    } catch (_) {
      /* 아래 단계로 진행 */
    }
  }

  // 2) exception: 'frappe.exceptions.LinkValidationError: Could not find Price List: ...'
  if (data?.exception) {
    const text = String(data.exception)
    const colon = text.indexOf(': ')
    return stripHtml(colon > -1 ? text.slice(colon + 2) : text)
  }

  if (data?.message) return stripHtml(String(data.message))
  if (data?.exc_type) return String(data.exc_type)

  return error?.message || (status ? `HTTP ${status}` : '알 수 없는 오류')
}

function stripHtml(text) {
  return text.replace(/<[^>]*>/g, '').trim()
}

export default frappeErrorMessage
