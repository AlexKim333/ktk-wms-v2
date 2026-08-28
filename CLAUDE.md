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
- 다음 단계: 실제 ERP/모바일 현장 테스트, `adminApi` 우회 코드 완전 제거, POS/상품 리스트 뷰 고도화, 음성 명령 확장.
