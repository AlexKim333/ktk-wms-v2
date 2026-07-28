import { _testExports } from './src/utils/SamdoriBrain.js';
const {
  normalizeSpokenQuery,
  findMatchingCandidates,
  buildMultiCandidateQuestion,
  attachResolvedItem
} = _testExports;

let passedCount = 0;
let totalCount = 0;

function assert(condition, testName, details = '') {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`[PASS] ${testName}`);
  } else {
    console.error(`[FAIL] ${testName} ${details ? '- ' + details : ''}`);
    process.exitCode = 1;
  }
}

async function runTests() {
  console.log('========================================================================');
  console.log('    SamdoriVoice 4대 핵심 아키텍처 상용화 단위 검증 테스트 시작');
  console.log('========================================================================\n');

  // Test DB with various real warehouse items
  const validItems = [
    'P-160-REY-300',
    'P-160-NEGRO-300',
    'P-160-BLANCO-300',
    'P-160-ROJO-300',
    'P-160-AZUL-300',
    'P-160-VERDE-300',
    'P-160-AMARILLO-300',
    'P-160-GRIS-300',
    'P-160-ROSA-300',
    'P-160-SURTIDO-300',
    'L-PL160-BLANCO-10',
    '3331-SURTIDO-200',
    '3331-SURTIDO-308',
    '3331-1-SURTIDO-252',
    '3331-2-SURTIDO-100',
    '3331-3-SURTIDO-150',
    '3331-4-SURTIDO-120',
    'L-OP80-SURTIDO-12',
    'L-OP80-NEGRO-12',
    'L-OP80-BLANCO-12'
  ];

  // 1. [Rule 1] P- 접두사 강제 폐지 & 숫자 독립 토큰 매칭
  console.log('--- 1. [Rule 1] P- 접두사 강제 폐지 & 숫자 독립 토큰 매칭 검증 ---');
  const t1_norm = normalizeSpokenQuery('160 알라르꼰 창고에 몇 개가 있는가', '', validItems);
  assert(
    t1_norm.prefix === '160',
    '1-1. DB에 160 포함 상품(P-160, L-PL160) 존재 시 P- 강제 안 하고 "160" 반환',
    `Got: ${t1_norm.prefix}`
  );

  const t1_candidates = findMatchingCandidates('160', '', validItems);
  assert(
    t1_candidates.includes('P-160-REY-300') && t1_candidates.includes('L-PL160-BLANCO-10'),
    '1-2. "160" 검색 시 P-160 및 L-PL160 상품을 모두 후보로 추출',
    `Got: ${t1_candidates.join(', ')}`
  );

  const t1_notInDb = normalizeSpokenQuery('999 알라르꼰', '', validItems);
  assert(
    t1_notInDb.prefix === 'P-999',
    '1-3. DB에 아예 없는 번호("999") 발화 시 기존 보조 로직("P-999") 작동',
    `Got: ${t1_notInDb.prefix}`
  );

  // 2. [Rule 2] 색상 미지정 시 기본색상 SURTIDO 자동 확정
  console.log('\n--- 2. [Rule 2] 색상 미지정 시 기본색상 SURTIDO 자동 확정 검증 ---');
  const t2_parsed = { raw_spoken_item: 'P-160', intent: 'search', spoken_text: 'P-160 재고 알려줘' };
  const t2_res = await attachResolvedItem(t2_parsed, validItems, {});
  assert(
    t2_res.item === 'P-160-SURTIDO-300' && t2_res.intent === 'search',
    '2-1. "P-160" (단일 가족) 색상 미지정 시 SURTIDO 자동 확정',
    `Got item: ${t2_res.item}, intent: ${t2_res.intent}`
  );

  const t2_mixed = { raw_spoken_item: '160', intent: 'search', spoken_text: '160 재고 알려줘' };
  const t2_mixedRes = await attachResolvedItem(t2_mixed, validItems, {});
  assert(
    t2_mixedRes.intent === 'ask_clarification' &&
      !t2_mixedRes.item &&
      (t2_mixedRes.question || '').includes('너무 많습니다'),
    '2-2. "160" (P-160 + L-PL160 혼재) 시 SURTIDO 자동 확정하지 않고 역질문',
    `Got item: ${t2_mixedRes.item}, intent: ${t2_mixedRes.intent}, q: ${t2_mixedRes.question}`
  );

  // 3. [Rule 3] 3단계 스마트 역질문 엔진 (Tier 1, Tier 2, Tier 3)
  console.log('\n--- 3. [Rule 3] 3단계 스마트 역질문 엔진 검증 ---');
  const hugeCandidates = Array.from({ length: 15 }, (_, idx) => `P-60-COLOR-${idx}`);
  const t3_tier1 = buildMultiCandidateQuestion('60', hugeCandidates, '한국어 발화');
  assert(
    t3_tier1.includes('너무 많습니다') && t3_tier1.includes('영문자(예: P, L 등)나 규격을'),
    '3-1. (Tier 1) 10개 초과 대량 후보 시 영문자(P, L 등) 입력 요구 안내멘트 생성',
    `Got: ${t3_tier1}`
  );

  const surtido6 = validItems.filter(i => i.startsWith('3331')); // 6 items, all SURTIDO
  const t3_tier2 = buildMultiCandidateQuestion('3331', surtido6, '한국어 발화');
  assert(
    t3_tier2.includes('기본 색상(SURTIDO) 상품이 6가지 있습니다') && t3_tier2.includes('포장개수나 세부 번호를'),
    '3-2. (Tier 2) 6~10개 후보 중 모두 SURTIDO일 때 포장개수/세부번호 요구 안내멘트 생성',
    `Got: ${t3_tier2}`
  );

  const t3_tier3 = buildMultiCandidateQuestion('160', ['P-160-REY-300', 'L-PL160-BLANCO-10'], '한국어 발화');
  assert(
    t3_tier3.includes('2가지 있습니다. 예: P-160-REY-300, L-PL160-BLANCO-10') && t3_tier3.includes('어떤 상품을 조회할까요?'),
    '3-3. (Tier 3) 2~5개 소수 정밀 후보 시 대표 SKU 예시 제시 및 선택 질문',
    `Got: ${t3_tier3}`
  );

  // 4. [Rule 4] SURTIDO 고유 색상 법칙 (다중 고유 색상 공존 vs 단일 색상)
  console.log('\n--- 4. [Rule 4] SURTIDO 고유 색상 법칙 검증 ---');
  const t4_parsed = { raw_spoken_item: 'L-OP80', intent: 'search', spoken_text: 'L-OP80 재고 알려줘' };
  const t4_res = await attachResolvedItem(t4_parsed, validItems, {});
  assert(
    t4_res.intent === 'ask_clarification' &&
    t4_res.question.includes('3가지 있습니다') &&
    t4_res.question.includes('L-OP80-SURTIDO-12, L-OP80-NEGRO-12, L-OP80-BLANCO-12'),
    '4-1. "L-OP80" (SURTIDO, NEGRO, BLANCO 공존) 발화 시 SURTIDO 임의 선택하지 않고 3색상 역질문',
    `Got intent: ${t4_res.intent}, q: ${t4_res.question}`
  );

  const t4_explicit = { raw_spoken_item: 'L-OP80 혼색', color: 'SURTIDO', intent: 'search', spoken_text: 'L-OP80 혼색 재고 알려줘' };
  const t4_resExplicit = await attachResolvedItem(t4_explicit, validItems, {});
  assert(
    t4_resExplicit.item === 'L-OP80-SURTIDO-12' && t4_resExplicit.intent === 'search',
    '4-2. "L-OP80 혼색" 명시적 발화 시 L-OP80-SURTIDO-12 상품으로 즉시 확정',
    `Got item: ${t4_resExplicit.item}, intent: ${t4_resExplicit.intent}`
  );

  console.log('\n========================================================================');
  console.log(`    검증 완료: 총 ${totalCount}개 테스트 중 ${passedCount}개 통과 (성공률 ${Math.round((passedCount/totalCount)*100)}%)`);
  console.log('========================================================================\n');
}

runTests().catch((err) => {
  console.error('테스트 실행 실패:', err);
  process.exit(1);
});
