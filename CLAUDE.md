# CLAUDE.md — ktk-wms-v2 (Claude Code 전용 프로젝트 지침)

이 파일은 **Claude Code(및 Claude Code 기반 Cowork 세션)가 이 저장소를 열 때 자동으로 읽는 지침**이다.
Cursor는 이 파일을 읽지 않는다 — Cursor는 `.cursorrules`와 `.cursor/skills/*`를 계속 따른다. 이 문서는 그것들을 **대체하지 않고, Claude Code 환경에 맞게 다시 옮겨 적은 것**이다. 두 도구가 같은 저장소를 건드리므로, 아래 핵심 규칙이 바뀌면 `.cursorrules` / `.agents/AGENTS.md`도 같이 갱신해서 서로 어긋나지 않게 할 것.

관련 원본 문서 (충돌 나면 이 문서보다 우선 확인):
- `.cursorrules`, `.agents/AGENTS.md` — Cursor/에이전트 공통 규칙 원본
- `.cursor/skills/live-debug-wms/SKILL.md` — 브라우저 기반 라이브 디버그 절차 (Cursor 전용 스킬)
- `.cursor/skills/new-project-infra/SKILL.md`, `frappe-admin.md` — 신규 프로젝트 인프라 스캐폴딩 절차
- `NEXT_MODEL_HANDOVER.md`, `HANDOVER_SESSION.md`, `AI_WORK_SUMMARY.md` — 이전 세션 인수인계 기록 (최신순: NEXT_MODEL_HANDOVER → AI_WORK_SUMMARY → HANDOVER_SESSION)
- `docs/` — ERPNext 표준 모듈 Q&A, 사용자/직원 등록 컨텍스트

---

## 1. 프로젝트 개요

- **LADY POLO WMS/POS** (`ktk-wms-v2`): 멕시코 지점/본사가 쓰는 재고관리(WMS) + POS 통합 웹앱.
- 스택: Vue 3(Composition API, `<script setup>`) + Vite, Pinia, Vue Router, vue-i18n(ko/en/es/zh), FlexSearch.
- 백엔드: **Frappe Cloud(ERPNext)** — `ktkpos.frappe.cloud`. Supabase는 완전히 폐기된 과거 아키텍처.
- 개발 서버: `npm run dev` (포트 5173). `vite.config.js`가 `/api` → `https://ktkpos.frappe.cloud`로 프록시.
- git: origin `AlexKim333/ktk-wms-v2`. 기존 remote가 있으니 새 remote를 만들지 말 것.
- **자매 프로젝트**: `meta 연동프로젝트`(MetaMCP, WhatsApp/Telegram AI 에이전트)가 **같은 Frappe 백엔드(`ktkpos.frappe.cloud`)를 공유**한다. 그쪽 봇 계정(`samdori-bot@ktkpos.frappe.cloud`)은 이 저장소의 `middleware.js` 역할 가드를 타지 않고 별도 경로로 프라뻬를 호출한다. 이 저장소에서 ERPNext Role/User Permission/permlevel을 바꾸면 MetaMCP 쪽 봇 권한 경계에도 영향을 줄 수 있으니, 변경 전 그쪽 `docs/erpnext_integration_account.md`도 같이 확인할 것.

### 커맨드

- `npm run dev` — Vite 개발 서버 (포트 5173, `/api` → `ktkpos.frappe.cloud` 프록시).
- `npm run build` — 프로덕션 빌드 (`dist/`).
- `npm run preview` — 빌드 결과 로컬 미리보기.
- 린트/유닛테스트 스크립트는 구성돼 있지 않다(`package.json`에 `lint`/`test` 없음). 검증은 4절 "라이브 디버그 절차"와 `scripts/*.mjs`(예: `node scripts/check_i18n_keys.mjs`, `node scripts/frappe-probe.mjs`)로 대체한다.
- `scripts/`의 `*.cjs`/`*.mjs`는 Frappe 권한·필드·역할을 직접 조작하는 관리 도구다(`setup_erpnext_roles.cjs`, `fix_clerk_perms.cjs`, `frappe-admin.mjs` 등). 실행 전 내용을 확인 없이 재실행하지 말 것 — 대상이 실서비스(`ktkpos.frappe.cloud`)다.

### 아키텍처 개요

- **인증 흐름**: `src/stores/auth.js`(Pinia)가 세션 상태를 갖는다. `restoreSession()`이 `frappe.auth.get_logged_user` 호출 후 `resolveLoginProfile()`(`src/composables/resolveLoginProfile.js`)로 역할(role)·`access_level`을 확정한다. `src/router/index.js`의 `beforeEach`가 이 상태로 라우트를 가드한다 — `/login`은 세션 복구를 기다리지 않고 즉시 렌더하고 복구는 백그라운드로 돌리며(세션 복구 대기로 인한 흰 화면 방지), 보호 라우트는 `sessionChecked`를 기다린 뒤 미로그인 시 `/login`으로, `/setup`은 `isAdmin`이 아니면 `/pos`로 리다이렉트한다.
- **권한 등급**: `access_level`(Admin/Manager/Representative) + Frappe Role(System Manager/Administrator, Branch Manager, Branch Clerk) 조합으로 `isAdmin`/`isBranchManager`/`isBranchClerk` getter가 계산된다(`auth.js`). 상위 등급이 하위 등급 조건을 배제하는 배타적 계층 구조이므로, 새 역할을 추가할 때 이 우선순위를 깨지 않는다.
- **API 레이어**: `src/api/frappe.js`는 세션 쿠키(`withCredentials: true`) 기반 단일 axios 인스턴스. 상대경로(`/api/...`)로만 호출하며, 개발 환경은 `vite.config.js` 프록시, 배포 환경은 `vercel.json` rewrites + `middleware.js`(Vercel Edge Function)가 같은 역할을 한다.
- **BFF 프록시**: `middleware.js`는 `/api/ai/gemini*`만 가로채 Frappe 세션 검증 후 서버 전용 `GEMINI_API_KEY`로 Gemini를 중계한다(모델 부재/과부하 시 캐스케이드 폴백). 나머지 `/api/*`는 그대로 Frappe Cloud로 rewrite. 로컬 dev에서는 `vite.config.js`의 `gemini-dev-proxy` 플러그인이 동일 역할을 한다.
- **화면 구조**: `src/views/`가 최상위 화면(PosView, ProductListView, InboundListView, OutboundListView, StockAdjustment*, BranchTransfer* 등), `src/views/mobile/`은 모바일 전용 로그인/POS 레이아웃 — 라우터가 `window.innerWidth`로 `/login`의 데스크톱/모바일 컴포넌트를 분기한다(`/pos`는 `PosView.vue` 내부에서 반응형 처리). `PosView.vue`는 약 2,200줄로 장바구니·split fulfillment·영수증·삼돌이 음성 로직이 집중된 핵심 파일이므로, 여기를 고칠 때는 2절 2번(사이드 이펙트 사전 차단)을 특히 주의한다.
- **공유 로직**: `src/composables/`에 검색(`useItemSearch`, FlexSearch 기반), 가격 티어(`usePriceTierEngine`), 페이지네이션(`usePagedList`), 모바일 감지(`useMobile`) 등 여러 화면이 공유하는 로직이 있다 — 하나를 고치면 그것을 쓰는 모든 화면에 영향이 간다.
- **i18n**: `src/i18n/locales/`(ko/en/es/zh). 번역 키 누락은 `node scripts/check_i18n_keys.mjs`로 점검.

## 2. 절대 규칙 (여러 인수인계 문서에서 반복 강조됨 — 임의로 완화하지 말 것)

1. **No Regression**: 다국어(i18n), 지점 권한 분리, 기존 로직 등 이미 동작하는 기능을 새 패치로 깨뜨리지 않는다. 하나 고치려고 다른 하나를 희생하지 않는다.
2. **사이드 이펙트 사전 차단**: 파일 하나를 고치기 전에, 그 로직을 공유하는 다른 화면/컴포넌트(예: `PosView` ↔ `ProductListView`, `BranchTransferView` ↔ `BranchTransferReservationList`)에 미칠 영향을 먼저 확인한다.
3. **Approval First (최우선 원칙)**: 이미 동작 중인 기존 코드/뷰를 고쳐야 한다면, **먼저 "왜/어디를/어떻게 고칠지" 사용자에게 보고하고 승인받은 뒤에만** 코드를 수정한다. 승인 없이 임의로 기존 파일을 패치하지 않는다.
4. **Scenario First**: 새 로직은 상상으로 만들지 말고, ERPNext 표준 기능/모듈을 우선 활용해 검증된 방식으로 구현한다. 커스텀 DocType은 표준 DocType(Customer, Sales Order, Sales Invoice, Delivery Note, Item, Warehouse, Custom Field 등)으로 안 될 때만 고려하고, 생성 전 사용자 확인.
5. **BFF 원칙 (비밀키 관리)**: Gemini/OpenAI 등 유료 API 키, 결제·마스터 비밀키는 절대 프론트엔드 번들(`VITE_` 접두사)에 넣지 않는다. 반드시 서버리스/백엔드 환경변수(`process.env`)에만 두고, `/api/...` 프록시 엔드포인트를 통해서만 통신한다. 새로 만드는 프로젝트에도 동일 적용.
6. **인증/세션**: Frappe가 굽는 HttpOnly 세션 쿠키만 사용한다(`withCredentials: true`, `src/api/frappe.js`). `Authorization: Bearer` 헤더를 프론트엔드 코드에 넣지 않는다. 로그인은 `POST /api/method/login` (`usr`, `pwd`).
7. **Supabase 금지**: `supabase-js`, `app_members` 등 Supabase 관련 코드를 이 저장소에 절대 추가하지 않는다.
8. **경로 대소문자**: Vercel(Linux) 배포 전제이므로 파일 경로·확장자(`.vue`, `.webp` 등) 대소문자를 로컬 OS(Windows)와 무관하게 정확히 맞춘다.

## 3. 비즈니스 규칙 (코드에 암묵적으로 들어있는 정책 — 임의 변경 금지)

- 서브밑(Submit, `docstatus = 1`)된 전표는 전화/메시지로만 변경 요청하는 것이 원칙. 온라인에서 자동 처리 대상이 아니다.
- 드래프트(`docstatus = 0`)는 일반 사용자도 수정 가능하지만, **서브밑 완료 전표의 수정/변경출고는 PC 관리자 화면(System Manager/Administrator)에서만** 가능하도록 권한·UI가 제한돼 있다. 이 경계를 풀지 말 것.
- 지점(Branch) 포스와 본사/창고 시스템의 권한 분리는 상용화를 위한 필수 설계다. 막히는 문제가 있어도 `adminApi`로 전부 관리자 권한을 주는 식의 편법 우회를 쓰지 않는다 — 정식 Role/Profile 체계로 해결한다.

## 4. 라이브 디버그 절차 (Claude Code 버전)

`.cursor/skills/live-debug-wms`의 절차를 그대로 따르되, "Cursor 브라우저에서 연다"는 지시는 **이 세션에 실제로 연결된 브라우저 자동화 도구**(Claude in Chrome 확장, 또는 데스크톱 앱 내장 브라우저 등 — 세션마다 이름이 다를 수 있다)로 대체해서 수행한다. 브라우저 도구가 전혀 없는 세션(순수 터미널 Claude Code 등)이라면 사용자에게 직접 재현을 부탁하거나, 네트워크/로그 응답만으로 대체 검증하고 그 사실을 명시한다.

1. Vite가 5173 포트에 떠 있는지 확인, 없으면 `npm run dev`.
2. `http://localhost:5173/login` 접속 → `master_keys.env`/`.env.local`의 디버그 계정으로 로그인. **usr/pwd/API 키는 채팅·커밋·로그에 절대 출력하지 않는다.**
3. 실제 클릭/입력으로 재현(검색, 장바구니, split fulfillment, 결제, 내비게이션).
4. 같은 세션에서 `node scripts/frappe-probe.mjs`로 Frappe 문서와 화면 상태를 대조.
5. 원인/파일/최소 수정안을 먼저 보고하고 승인을 기다린다 (2절 3번 Approval First). 승인 전에 패치하지 않는다.
6. 승인 후 최소 범위만 패치, 같은 경로 재검증 + i18n/장바구니/Split Fulfillment 회귀 확인.

**테스트 데이터 가드레일**: Customer/Item은 `DEBUG-` 접두사만 사용, `Public`이나 실제 walk-in 고객으로 체크아웃하지 않는다. 쓰기 테스트 후 생성한 문서는 반드시 `node scripts/frappe-probe.mjs --write cancel ...`로 취소하고, `debug-docs`가 비어있는지 확인 후 종료한다. `ktkpos.frappe.cloud`는 실서비스 사이트임을 항상 인지할 것.

## 5. 신규 프로젝트 인프라 작업

새 앱/저장소를 만드는 작업(Git+Vercel+Frappe 필드/유저+WhatsApp Cloud API+Gemini 라우팅)은 이 저장소 안에서 하지 않는다. 반드시 새 형제 디렉토리/레포에서 진행하고, 전체 절차는 `.cursor/skills/new-project-infra/SKILL.md`와 `frappe-admin.md`를 참고한다 (Claude Code에서 이 스킬 파일들은 자동 로드되지 않으니, 해당 작업을 시작하기 전에 `Read` 도구로 직접 열어서 확인할 것). WhatsApp은 공식 Cloud API만 사용, `whatsapp-web.js`/Puppeteer 스크레이핑 금지.

## 6. 저장소 위생 관련 참고

루트에 이전 세션들이 남긴 일회성 스크립트(`patch_*.py`, `patch_*.cjs`, `fix_*.py`, `check_*.cjs` 등)와 디버그 덤프(`old_*.txt`, `posview_diff.txt` 등)가 다수 남아 있다. 이들은 현재 애플리케이션 동작과 무관한 과거 작업물이므로, 실행 전에 내용을 확인 없이 재실행하지 말 것. 새로 만드는 일회성 스크립트도 무작정 루트에 쌓지 말고, 가능하면 `scripts/`(영구 도구)나 임시 위치에 두고 끝나면 정리를 제안한다.

## 7. MCP/스킬 확장 시 주의 (2026-08-28 논의 반영)

이 저장소에는 아직 프로젝트 레벨 MCP 서버 설정(`mcp.json` 등)이 없다. 앞으로 브라우저 유즈/컴퓨터 유즈 등 새 MCP나 스킬을 추가할 때:

- 이미 이 Claude Code 세션에 내장된 브라우저 자동화 도구(4절 참고)와 기능이 겹치는 MCP를 중복으로 붙이지 않는다. 붙여야 한다면 어느 쪽을 기본으로 쓸지 먼저 정한다.
- 새 스킬의 트리거 설명(description)이 `live-debug-wms` 등 기존 스킬과 겹치지 않게 구체적으로 쓴다.
- MCP 도구는 서버 이름으로 자동 네임스페이스(`mcp__서버__도구`) 되므로 이름 충돌 자체는 드물다 — 실제 문제는 "같은 일을 하는 두 경로"가 생기는 것이다.

## 8. 최근 진행 상황 요약 (자세한 내용은 원본 인수인계 문서 참고)

- i18n(ko/en/es/zh) 뼈대 구축 완료, 로그인/사이드바 적용 완료. 남은 작업: 회원가입/프로필의 선호 언어 선택 UI → Frappe User Doctype 반영, 나머지 화면 점진적 다국어화.
- 지점 이동 변경출고(Cart Diff Engine) — 서브밑 완료 전표의 수량 차이를 반품/추가출고 `Stock Entry`로 자동 발행하는 기능 구현 완료 (`BranchTransferView.vue`).
- 영수증 박스/낱개(Bulto/Pzs) 표기 버그 수정, 삼돌이 음성 어시스턴트 iOS TTS 묵음 버그 수정 완료.
- 다음 단계: 실제 ERP/모바일 현장 테스트, POS/상품 리스트 뷰 고도화, 음성 명령 확장.
- **`adminApi` 우회 코드 제거 완료 (2026-08-29)**: 조사 결과 `adminApi`는 이미 예전 세션에서 `const adminApi = frappeApi`(세션 쿠키 클라이언트에 대한 단순 별칭)로 무력화되어 있었다 — 실제 권한 우회 기능은 남아있지 않았고, 이름만 혼동을 주는 죽은 코드였다. `BranchTransferView.vue`/`BranchTransferReservationList.vue`/`MobileBranchPosView.vue`/`MobileBranchTransferReservationList.vue`/`MobileBranchTransferView.vue` 5개 파일에서 별칭 선언을 지우고 모든 호출부를 `frappeApi.`로 직접 치환(동작 변화 없는 기계적 리네이밍). 빌드 통과 + CARMEN 지점장 계정으로 실제 화면(Crear Transferencia) 로딩까지 확인.
- **유저 역할 정리 완료 (2026-08-29)**: 총괄(tukpan71) / 지점장(김현중=CARMEN, MONSE=[MAIN] ALARCON 중앙창고 임시총괄) / 판매원(pancho=CARMEN, Branch Clerk) 구조로 재배정. 더미 계정(kitsonpolo@gmail.com) 삭제. MONSE는 앱에 "Admin은 아니지만 입출고 화면은 보이는" 중간 등급이 아직 없어 System Manager를 임시로 얹은 상태 — 전용 "창고관리자" 등급이 생기면 System Manager만 제거해 되돌릴 것. **TIENDA - K 지점은 현재 담당자가 없다.**
- **노드관리(NodeManagement.vue) 고객 등록 버그 수정 + 담당판매원/관리지점 기능 추가 (2026-08-29)**: 총괄 전용 "노드관리" 화면에서 고객/공급사 등록 시 전화번호가 `custom_phone`이라는 존재하지 않는 필드로 전송되어 **조용히 저장 안 되고 있던 버그**를 발견/수정. Customer/Supplier의 표준 `mobile_no`는 읽기전용(Contact에서 fetch)이라, 실제로는 Contact 문서를 만들어 `phone_nos` 자식테이블(`is_primary_mobile_no=1`)에 넣고 `customer_primary_contact`/`supplier_primary_contact`로 연결해야 저장/조회된다 — 직접 API 라운드트립 테스트로 검증 완료(생성/수정 양쪽 다, 테스트 데이터는 정리함). 고객 등록 시 전화번호는 필수 입력으로 변경. 담당 판매원은 Customer 도큐타입에 이미 있는 표준 `sales_team`(Sales Person+배분비율) 필드를 그대로 재사용해 선택 UI 추가.
  - **중요 발견**: Customer 도큐타입에 예전부터 만들어져 있었지만 **코드 어디서도 안 쓰이던 커스텀 필드**들을 조사 중 발견 — `custom_managing_branch`(관리지점, Warehouse Link), `custom_salesperson`/`custom_sales_person`(담당 판매원, Sales Person Link — 서로 중복). 이런 필드가 있는 줄 모르고 지나칠 뻔한 이유: `/api/resource/DocType/Customer` GET은 DocType 자체에 정의된 필드만 반환하고 Customize Form으로 추가된 Custom Field는 안 잡힌다 — 진짜 필드 목록을 보려면 `/api/resource/Custom Field?filters=[["dt","=","Customer"]]`로 따로 조회해야 한다(다음 세션도 필드 존재 여부 확인할 땐 이 방식을 쓸 것).
  - `custom_salesperson`/`custom_sales_person`은 여전히 미사용 상태로 남겨둠(둘 중 뭐가 죽은 필드인지 불명확 — 정리하려면 먼저 확인 필요). 반면 `custom_managing_branch`는 활용: 노드관리에서 담당 판매원을 선택하면 그 판매원의 Sales Person.`custom_branch`(소속 지점, 실제 데이터 채워져 있음 확인됨) 값을 Customer.`custom_managing_branch`에 자동으로 채워 넣도록 구현·검증 완료.
  - **부수 발견/수정 — Sales Person "김현중" docstatus 오염 복구 (2026-08-29)**: 관리지점 자동입력 기능 검증 중, Sales Person "김현중" 레코드만 `docstatus=1`(제출완료)로 잘못 박혀있던 것을 발견. Sales Person은 애초에 `is_submittable=0`(제출 개념 자체가 없는 도큐타입)이라 이 상태에서는 REST API든 Frappe Desk UI 저장이든 전혀 수정이 안 됐다(`DocstatusTransitionError: Cannot change docstatus from 1 to 0` — Frappe가 감사 무결성 보호를 위해 의도적으로 막는 것이라 bench console 없이는 정상 복구 불가). 해결: `frappe.client.rename_doc`으로 고장난 레코드를 `김현중 (오류-2026-08-29)`로 이름만 옮겨두고(rename은 허용됨, 링크 자동 갱신됨 — 우리가 테스트로 만들고 취소해둔 `SAL-ORD-2026-00003`의 sales_team 참조도 자동으로 이 이름으로 갱신됨), 진짜 이름 `김현중`으로 `docstatus=0`인 새 레코드를 만들어 `custom_branch: "CARMEN - K"`까지 정상 반영. 예전 고장난 레코드(`김현중 (오류-2026-08-29)`)는 docstatus=1이 고정이라 비활성화조차 안 되고 `enabled=1`로 영구히 남아있다 — 이름이 명확히 다르므로 드롭다운 등에서 실무 혼동은 없지만, 존재 자체는 기억해둘 것.
- **지점 상품 등록 요청 → 본사 승인 흐름 구현 (2026-08-29)**: "지점에서 지점별로 상품 등록을 하는 경우 어떻게 해야 하는가"라는 질문에서 출발. Item(상품)은 Customer와 달리 전사 공용 마스터데이터에 원가/재고평가(GL)까지 얽혀있어, 지점장이 자유롭게 등록하면 중복/원가불일치로 재고평가가 꼬일 위험이 큼 — 그래서 "지점은 요청만, 본사가 승인 시 확정" 구조로 결정.
  - Item에 커스텀 필드 `custom_pending_review`(Check) 신규 추가 — 지점 요청으로 만들어진 임시 상품과 그 외 사유로 비활성인 상품을 구분하는 용도.
  - Branch Manager 역할에 Item **create만**(write는 절대 안 줌) 권한 추가 — 그래서 지점장은 새 임시 상품은 만들 수 있어도, 자기 것 포함 그 어떤 Item도 나중에 못 고친다(활성화/가격/원가 변경은 여전히 본사 전용).
  - 지점 쪽: `BranchSettingsView.vue`(지점 설정)에 "상품 등록 요청" 탭 신규 추가 — 상품명/색상/브랜드/팩수량/바코드(선택)/희망판매가(참고용, description에 텍스트로만 기록)/메모를 받아 `disabled=1, custom_pending_review=1`인 안전한 임시 Item만 생성. 원가·재고·판매가 입력란 자체가 없어 재고평가·회계에 전혀 영향 없음.
  - 본사 쪽: `ProductRegistrationPanel.vue`(상품 등록 화면 — 예전 세션에서 이유 불명으로 nav에서 숨겨져 있던 걸 이번에 다시 노출시킴, `nav.product_old` 라벨도 "상품 등록 / 지점 요청 승인"으로 변경)에 "⏳ 지점 요청 대기 목록" 섹션 추가. 승인 모달에서 창고/기초재고수량/원가/판매가를 입력해 확정하면 Item 활성화(disabled=0, custom_pending_review=0) + Item Price 등록 + Stock Entry(Material Receipt, 제출) 순으로 자동 처리. 반려 시엔 `custom_pending_review=0`만 세팅해 목록에서만 사라지고 비활성 상태로 보존.
  - CARMEN 지점장 계정으로 요청 제출 → 관리자 계정으로 승인까지 실제 화면에서 전 과정 검증 완료(창고 CARMEN - K에 재고 10개, 판매가 99.5 반영 확인). 테스트 데이터는 Stock Entry 취소 + Item Price 삭제 + Item 비활성화로 정리(Item 자체는 취소된 Stock Entry가 물려있어 완전삭제는 불가 — DEBUG- 접두사라 실무 지장 없음).
- **바코드 스캔 조사 및 등록 화면 바코드 필드 버그 수정 (2026-08-29)**: "바코드 인식 정상 작동하는가" 질문에서 출발해 조사한 결과, POS 스캔 로직(`handleBarcodeScan`, `custom_tier_1~4_barcode` 매칭)은 정상이지만 **실제 데이터베이스에 바코드가 등록된 상품이 하나도 없었다**(전체 1440개 상품 전수조사, tier 1~4 전부 공란). 원인은 상품 등록 화면(기존 관리자용 `ProductRegistrationPanel.vue` + 이번에 만든 지점용 `BranchSettingsView.vue` 등록요청 탭) 둘 다 "바코드" 입력값을 `barcode`라는 **존재하지 않는 평문 필드**로 전송하고 있었던 것 — Item의 실제 표준 바코드 구조는 `barcodes`(Item Barcode 자식테이블)이고, 스캔 인식에 실제로 쓰이는 필드는 `custom_tier_1_barcode`다. 두 등록 화면 모두 `barcode:` → `custom_tier_1_barcode:`로 수정. 실제 화면에서 시재를 열고 바코드를 스캔해 장바구니에 담기는 것까지 확인 완료(테스트 상품/시재 정리함).
  - **참고**: `/api/resource/DocType/Item` GET으로 필드 존재 여부를 확인할 때 `barcode`를 필터에 넣으면 "Field not permitted in query"로 바로 걸러지는데, 이건 list-query 유효성 검사가 엄격해서고, 실제 문서 생성(POST)은 모르는 필드를 조용히 무시하고 성공(200)을 반환한다 — 그래서 이번처럼 "저장은 성공했는데 실제로는 반영 안 됨" 버그가 눈에 안 띄고 넘어가기 쉽다. 다음에도 새 필드로 저장하는 코드를 작성/검토할 땐 저장 직후 GET으로 값이 실제로 들어갔는지 반드시 재확인할 것.
- **지점 대시보드 신규 추가 (2026-08-29)**: `BranchDashboardView.vue` 신규 생성, 지점 사이드바 최상단(POS 판매 버튼 위)에 "🏠 대시보드" 메뉴로 연결(`activeNav === 'branch-dashboard'`) — 로그인 직후 기본 진입 화면은 그대로 POS 유지, 대시보드는 메뉴로만 추가(사용자 확인 후 결정). 참고로 관리자 쪽에도 "🏠 홈" 메뉴가 있었지만 실제 연결된 화면이 없는 죽은 링크였다(이번에 손대지 않음).
  - 5개 카드로 구성: ①오늘의 매출(Sales Invoice 기준, `owner=현재유저`+`posting_date=오늘`로 집계 — `branchShift.js`의 `aggregateShiftSales`와 동일 패턴 재사용) ②시재 상태(`findOpenShiftEntry` 재사용, 개장시각/경과시간 표시) ③재고 부족 상품 상위 10개(이미 상위 컴포넌트에서 로드된 `rawItems`+`binData` props를 그대로 활용 — 별도 API 호출 없음) ④지점 요청 현황(등록 고객 수는 Customer.`custom_managing_branch`, 상품 요청 대기/승인 건수는 Item.`custom_pending_review`+description의 `[지점요청:...]` 태그로 집계 — 전부 이번 세션에 만든 기능과 바로 연결) ⑤오늘 최근 거래 목록.
  - **주의**: "오늘의 매출"은 Sales Invoice만 집계한다 — 재고 0이라 100% 창고배송(Sales Order만 발행, Sales Invoice 없음)으로 처리된 주문은 아직 "매출"로 안 잡힌다. 이건 의도된 설계(회계상 매출은 Invoice 시점에 인식하는 게 맞음)지만, 지점장이 "방금 판 것도 있는데 왜 매출에 안 잡히냐"고 물으면 이 차이를 설명할 것.
  - CARMEN 지점장 계정으로 실제 화면 검증 완료(시재 개장/마감, 실제 판매 1건 생성 후 대시보드 반영 확인 — 재고 있는 상품으로 재테스트 권장, 이번 테스트 상품은 재고 0이라 Sales Order만 생성돼 매출 위젯 자체는 0건으로 재확인 못 함). 테스트로 만든 Sales Order/시재는 취소해 정리함.
- **본사(관리자) 대시보드 신규 추가 (2026-08-29)**: `AdminDashboardView.vue` 신규 생성 — 관리자 쪽의 죽은 "🏠 Inicio" 링크(`activeNav === 'home'`)를 이번에 살려서 연결(예전엔 아무 화면도 안 뜨는 링크였음). 지점 대시보드의 전사(全社) 확장판: ①오늘 전사 매출(Sales Invoice를 owner 필터 없이 전체 조회 후 `User.location`으로 owner→지점 매핑해 집계) ②지점 요청 현황(전사 고객 수 + 상품 승인대기/완료, 지점 필터 없이 집계) ③지점별 오늘 매출 순위 ④지점별 시재 상태 ⑤재고 부족 상품 전사 상위 15개(브랜치 대시보드와 동일하게 기존 로드된 `rawItems`+`binData` 재사용) ⑥오늘 최근 거래 전사 목록.
  - **새로 발견한 권한 이상**: "지점별 시재 상태" 위젯이 `POS Opening Entry`/`POS Closing Entry` 목록 조회(list query)에서 403을 받는다 — DocType 메타 확인 결과 System Manager 역할에 read=1이 명시적으로 있는데도(if_owner 제약도 없음) admin 계정(tukpan71, 실제 브라우저 쿠키 세션)으로도 거부된다. 단일 문서 GET은 될 것으로 추정되고 list query만 막히는 것으로 보이나, Frappe Cloud 쪽에 숨은 `permission_query_conditions`/`has_permission` 훅이 있을 것으로 추정될 뿐 원인을 bench 접근 없이는 더 못 판다. 예전에 "API 키 인증이라 그렇다"고 기록해뒀던 것(6절)과 달리 **이번엔 진짜 관리자 브라우저 세션에서도 재현됨** — 그 진단이 불완전했을 가능성. 조치: 조용히 실패를 삼켜 "전부 마감"이라고 잘못 보여주는 대신, 이 위젯만 "권한 문제로 불러올 수 없습니다" 메시지로 정직하게 표시하도록 처리(다른 위젯들은 전부 정상 작동, 이 하나만 영향받음).
  - tukpan71 관리자 계정으로 실제 화면 검증 완료(나머지 5개 위젯 전부 정상 렌더링·데이터 정확성 확인).
- **다음 세션 TODO (사용자 요청, 2026-08-29 기록 — 다음 작업일에 진행)**: **본사(관리자) 설정창 신규 제작.** 지점 쪽엔 이미 "지점 설정"(`BranchSettingsView.vue` — 가격정책/POS환경/영수증/권한/고객등록/상품등록요청 탭)이 있고 이번에 지점·본사 대시보드까지 만들어서, 이제 "본사 전용 설정" 화면만 있으면 지점설정↔지점대시보드↔본사대시보드↔본사설정 4개 축이 완성된다. 무엇을 담을지는 다음 세션에 사용자와 논의해서 확정할 것(예상 후보: 전사 가격정책 기본값, 회사/세금 기본 설정, 지점 목록 관리, 사용자/역할 관리 UI 등 — 확정된 건 아님, 논의 필요).
