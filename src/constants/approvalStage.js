// Material Request 의 custom_approval_stage 상생값.
// 과거 버전이 한글/변형 문자열을 저장했기 때문에, 저장은 아래 영문값으로만 하고
// 조회는 LEGACY 별칭까지 함께 허용해야 구진 전표가 목록에서 사라지지 않는다.
export const APPROVAL_STAGE = {
  CLERK_REQUEST: 'Clerk Request',
  MANAGER_APPROVAL: 'Manager Approval'
}

const LEGACY = {
  [APPROVAL_STAGE.CLERK_REQUEST]: ['점원 요청', '점원요청', '대기(점원)'],
  [APPROVAL_STAGE.MANAGER_APPROVAL]: ['지점장 승인', '지점장승인', '대기(지점장)']
}

export const stageAliases = (stage) => [stage, ...(LEGACY[stage] || [])]

// Frappe REST 필터 한 줄을 만들어 준다. (구진값 포함 조회)
export const stageFilter = (stage) => ['custom_approval_stage', 'in', stageAliases(stage)]

export const isStage = (value, stage) => stageAliases(stage).includes(value)

// 화면 표시용 i18n 키. 매칭되지 않으면 null 을 돌려 원문을 그대로 쓰게 한다.
export const stageI18nKey = (value) => {
  if (isStage(value, APPROVAL_STAGE.CLERK_REQUEST)) return 'status.stage_clerk_request'
  if (isStage(value, APPROVAL_STAGE.MANAGER_APPROVAL)) return 'status.stage_manager_approval'
  return null
}
