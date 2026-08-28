/**
 * 지점별 POS Profile 이름 결정.
 *
 * 시재관리(POS Opening/Closing Entry)는 POS Profile(Link, 필수)이 있어야 발행할 수 있다.
 * 처음에는 `branchPriceList.js`처럼 "없으면 저장 시점에 자동 생성"하는 방식으로 만들었으나,
 * POS Profile 도큐타입은 Branch Manager 역할에 권한이 전혀 없어서(Accounts Manager/
 * Accounts User만 권한 보유) 지점장 계정이 개장 자체를 못 하는 문제가 있었다.
 *
 * 권한 변경은 보안 설정 변경이라 가볍게 결정할 사안이 아니라서(2026-08-28 논의),
 * 지점장 역할 권한은 건드리지 않고 대신 이름을 **결정적으로(deterministic)** 계산해서
 * 조회/생성 API 호출 자체를 없앴다 — 그래서 지점장 계정에 POS Profile 권한이
 * 전혀 없어도(Read조차) 정상 동작한다.
 *
 * 전제 조건: 관리자가 실제 지점마다 이 이름 규칙(`POS Profile - <지점창고명>`)으로
 * POS Profile을 미리 한 번 만들어둬야 한다 (scripts/provision_pos_profiles.cjs 참고).
 * 아직 안 만든 지점은 개장 시도 시 "Link 검증 실패"로 명확히 실패하며, 그 경우
 * 관리자에게 프로필 생성을 요청해야 한다(이 파일이 대신 만들어주지 않는다).
 *
 * 실측 확인된 POS Profile 필드 제약(2026-08-28, 관리자 세션으로 직접 검증. 아직
 * 프로필이 없는 지점을 새로 만들 때 참고):
 * - POS Profile은 autoname이 "Prompt"라 `name`을 명시적으로 지정해야 한다.
 * - `write_off_account`/`write_off_cost_center`가 필수다.
 * - `payments` 테이블에 Mode of Payment를 넣으려면 그 Mode of Payment가 이 회사(company)에
 *   대해 `default_account`를 갖고 있어야 한다. 이 백엔드는 "Cash"만 계좌가 설정돼 있고
 *   "Credit Card"/"Wire Transfer"는 비어 있어 넣으면 저장 자체가 거부된다.
 *   → 그래서 POS Profile에는 Cash만 등록한다. 카드/이체는 실물 시재 개념이 없어
 *   (은행 정산액이라 셀 수 없음) 어차피 개장/마감 잔액 입력 대상이 아니다.
 */

/** 지점 창고 Full Name으로부터 POS Profile 이름을 결정적으로 계산한다. API 호출 없음. */
export function posProfileName(branchName) {
  if (!branchName) return null
  return `POS Profile - ${branchName}`
}

export default posProfileName
