# 앱 관리자 및 지점 점원(Vendedor) 등록 UI 기획/컨텍스트 요약

이 문서는 집(다른 환경)에서 작업을 이어가실 때, 현재까지 논의된 '사용자 및 점원 등록 UI/UX'에 대한 맥락(Context)을 빠르게 파악하기 위해 작성되었습니다.

## 1. UI/UX 레이아웃 구조 (레퍼런스 반영)
최종 제공된 스크린샷들을 바탕으로, 뷰(View)의 레이아웃은 **2중 사이드바 구조**를 따릅니다.
* **Global Sidebar (좌측 다크 테마)**: `Inicio`, `Productos`, `Ventas` 등 앱의 메인 기능들을 탐색하는 주 네비게이션.
* **Preferences Sidebar (내부 라이트 테마)**: 설정 탭 진입 시 나타나는 보조 네비게이션 (`General`, `Usuarios`, `Vendedores` 등).
* **Main Content Area (우측 영역)**: 리스트 뷰 및 등록/수정 패널.

## 2. 사용자(User) vs 점원(Vendedor/Staff)의 분리
레퍼런스 이미지에서 확인된 가장 중요한 기획적 요소는 **시스템 관리자(User)**와 **단순 지점 점원(Vendedor)**의 명확한 분리입니다.

### A. 앱 관리자 (User)
- **대상**: 시스템(백엔드/어드민) 접속 권한이 필요한 관리자.
- **등록 프로세스**: 이름, 연락처, **접속 허용 IP (IP Whitelist)**, 세부 권한 등 상세 정보를 입력하여 등록.
- **주요 기능**: 현재 접속 중인 관리자의 IP를 기본값으로 자동 할당해주는 편의 기능 제공.

### B. 지점 점원 (Vendedor / Staff)
- **대상**: 실제 물류 창고나 매장에서 활동하며, 특정 거래(판매, 출고, 재고조사 등)의 담당자로 매핑하기 위해 필요한 인력.
- **등록 프로세스 (간소화)**: 
  - 이메일이나 복잡한 비밀번호 입력 없이 **'이름', '성', '소속 지점'** 만으로 간편하게 생성 (`Nuevo Vendedor` 모달 활용).
  - 본사 관리자 접속 시: 여러 지점을 묶어서 할당할 수 있도록 드롭다운/체크박스 제공.
  - 지점 관리자 접속 시: 해당 관리자의 소속 지점으로 자동 고정되고 선택창 숨김 처리.
- **미결정 사항 (Open Question)**: 이 "점원"들이 POS나 WMS 태블릿에서 작업을 수행할 때 어떻게 본인을 인증할 것인가? (예: 시스템 접속 없이 이름만 터치하여 선택할 것인지, 4자리 PIN 코드를 부여할 것인지). 

## 3. 작업 진행 방향 (Next Steps)
집에서 이어서 코딩 작업을 하실 때 다음 컴포넌트들을 중심으로 개발을 시작하시면 됩니다.

1. `src/views/SettingsLayout.vue` : 2중 사이드바(Global + Preferences)를 포함한 화면 구조 뼈대 잡기.
2. `src/views/UserManagementView.vue` : 관리자 목록(Usuarios) 뷰 컴포넌트.
3. `src/views/StaffManagementView.vue` : 점원 목록(Vendedores) 뷰 컴포넌트.
4. `src/components/StaffRegistrationModal.vue` : 점원 이름과 지점만 입력받는 간편 등록 모달 창 UI.

---
**Tip**: 프라페(Frappe) 백엔드 연동 시, 'Vendedor'는 ERPNext의 `Sales Person` 이나 커스텀 DocType으로 맵핑하고, 'User'는 프라페 기본 `User` DocType으로 맵핑하는 구조가 유리할 것입니다.
