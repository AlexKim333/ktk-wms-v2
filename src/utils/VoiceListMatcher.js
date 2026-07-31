import FlexSearch from 'flexsearch';
const Document = FlexSearch.Document || FlexSearch;

/**
 * 한국어 수사 -> 아라비아 숫자 매핑
 */
const KO_DIGIT_MAP = {
  영: 0, 공: 0, 일: 1, 한: 1, 하나: 1, 이: 2, 두: 2, 둘: 2,
  삼: 3, 세: 3, 셋: 3, 사: 4, 네: 4, 넷: 4, 오: 5, 다섯: 5,
  육: 6, 여섯: 6, 칠: 7, 일곱: 7, 팔: 8, 여덟: 8, 구: 9, 아홉: 9
};

const KO_UNITS = [
  ['천', 1000],
  ['백', 100],
  ['십', 10]
];

/**
 * 기본 색상/옵션 다국어 별칭 사전
 */
export const DEFAULT_COLOR_ALIASES = {
  네그로: 'NEGRO', negro: 'NEGRO', 검정: 'NEGRO', 검정색: 'NEGRO', 블랙: 'NEGRO', black: 'NEGRO',
  베이지: 'BEIGE', beige: 'BEIGE',
  블랑코: 'BLANCO', blanco: 'BLANCO', 화이트: 'BLANCO', 하얀: 'BLANCO', 흰색: 'BLANCO', white: 'BLANCO',
  로호: 'ROJO', rojo: 'ROJO', 빨강: 'ROJO', 빨간색: 'ROJO', red: 'ROJO',
  아술: 'AZUL', azul: 'AZUL', 파랑: 'AZUL', 파란색: 'AZUL', blue: 'AZUL',
  베르데: 'VERDE', verde: 'VERDE', 초록: 'VERDE', 초록색: 'VERDE', 녹색: 'VERDE', green: 'VERDE',
  아마리요: 'AMARILLO', amarillo: 'AMARILLO', 노랑: 'AMARILLO', 노란색: 'AMARILLO', yellow: 'AMARILLO',
  그리스: 'GRIS', gris: 'GRIS', 회색: 'GRIS', gray: 'GRIS', grey: 'GRIS',
  로사: 'ROSA', rosa: 'ROSA', 분홍: 'ROSA', 분홍색: 'ROSA', 핑크: 'ROSA', pink: 'ROSA',
  수르티도: 'SURTIDO', surtido: 'SURTIDO', 서티도: 'SURTIDO', 서티: 'SURTIDO', 혼색: 'SURTIDO', 기본색상: 'SURTIDO', 기본: 'SURTIDO'
};

/**
 * 단일 토큰 한국어 수사 변환
 */
export function koDigit(token) {
  const t = String(token || '').trim();
  if (t === '') return null;
  if (/^\d+$/.test(t)) return Number(t);
  return KO_DIGIT_MAP[t] ?? null;
}

/**
 * "백육십" -> 160, "삼천삼백삼십일" -> 3331 등 십/백/천 단위 숫자 변환
 */
export function parseKoreanNumberChunk(text) {
  let t = String(text || '').replace(/\s+/g, '');
  if (!t) return '';
  if (/\d/.test(t)) {
    const m = t.match(/\d+/g);
    return m ? m.join('') : '';
  }
  let n = 0;
  for (const [unit, mul] of KO_UNITS) {
    const idx = t.indexOf(unit);
    if (idx < 0) continue;
    const head = t.slice(0, idx);
    const count = head === '' ? 1 : koDigit(head);
    if (count == null) return '';
    n += count * mul;
    t = t.slice(idx + 1);
  }
  if (t) {
    const ones = koDigit(t);
    if (ones == null) return n ? String(n) : '';
    n += ones;
  }
  return n ? String(n) : '';
}

/**
 * 음절 단위 연속 숫자 발화 변환 ("삼삼삼일" -> "3331", "사삼공팔" -> "4308")
 */
export function parseKoreanDigitSequence(text) {
  const t = String(text || '').replace(/\s+/g, '');
  if (t.length < 3) return '';
  if (/[십백천만]/.test(t)) return '';
  let out = '';
  for (const ch of t) {
    const d = koDigit(ch);
    if (d == null || d > 9) return '';
    out += String(d);
  }
  return out;
}

/**
 * 발화 속 한글 수사/숫자/서브코드 변환 전처리 ("삼삼삼일-일 알라르꼰" -> "3331-1 알라르꼰")
 */
export function spokenNumeralsToDigits(text) {
  const s = String(text || '');
  if (!s) return '';
  const digitized = s.replace(/[영공일이삼사오육칠팔구십백천]{2,}/g, (run) => {
    const viaUnits = /[십백천]/.test(run) ? parseKoreanNumberChunk(run) : '';
    if (viaUnits && viaUnits.length >= 2) return viaUnits;
    const viaDigits = parseKoreanDigitSequence(run);
    if (viaDigits && viaDigits.length >= 2) return viaDigits;
    return run;
  });

  // 하이픈 뒤 한 자리 서브코드 ("3331-일" -> "3331-1")
  return digitized.replace(/(\d-)([영공일이삼사오육칠팔구])(?![가-힣])/g, (_, head, syllable) => {
    const d = koDigit(syllable);
    return d == null ? `${head}${syllable}` : `${head}${d}`;
  });
}

/**
 * 발화에서 한국어 서수(Ordinal Index) 표현 추출
 * 예: "첫 번째 상품", "1번", "두번째 거", "마지막"
 * @param {string} text - 음성 발화 텍스트
 * @returns {{ ordinalIndex: number|null, cleanedText: string }}
 *          ordinalIndex: 0-기반 리스트 인덱스 (-1: 리스트 마지막 요소, null: 없음)
 */
export function extractKoreanOrdinal(text) {
  const s = String(text || '');
  if (!s) return { ordinalIndex: null, cleanedText: s };

  // 마지막 / 맨 끝
  if (/(?:마지막|맨\s*끝|끝\s*번|끝\s*에)/.test(s)) {
    const cleaned = s.replace(/(?:마지막|맨\s*끝|끝\s*번|끝\s*에)(?:\s*(?:번째|번째로|번|째|상품|항목|거|것))?/g, '').replace(/\s+/g, ' ').trim();
    return { ordinalIndex: -1, cleanedText: cleaned };
  }

  // 특수 한국어 서수 단어 (예: 첫 번째, 두 번째, ...)
  const ORDINAL_WORDS = [
    { regex: /첫\s*번\s*째|첫\s*째/, idx: 0 },
    { regex: /두\s*번\s*째|둘\s*째/, idx: 1 },
    { regex: /세\s*번\s*째|셋\s*째/, idx: 2 },
    { regex: /네\s*번\s*째|넷\s*째/, idx: 3 },
    { regex: /다\s*섯\s*번\s*째|다\s*섯\s*째/, idx: 4 },
    { regex: /여\s*섯\s*번\s*째|여\s*섯\s*째/, idx: 5 },
    { regex: /일\s*곱\s*번\s*째|일\s*곱\s*째/, idx: 6 },
    { regex: /여\s*덟\s*번\s*째|여\s*덟\s*째/, idx: 7 },
    { regex: /아\s*홉\s*번\s*째|아\s*홉\s*째/, idx: 8 },
    { regex: /열\s*번\s*째|열\s*째/, idx: 9 }
  ];

  for (const { regex, idx } of ORDINAL_WORDS) {
    if (regex.test(s)) {
      // 서수 단어 및 바로 뒤에 붙는 선택적 명사(상품, 항목, 거, 것) 제거 (한국어 단어 경계 문제 해결)
      const cleanedText = s.replace(regex, '').replace(/^\s*(?:상품|항목|거|것)\s*/, ' ').replace(/\s+/g, ' ').trim();
      return { ordinalIndex: idx, cleanedText };
    }
  }

  // 숫자 + 번/번째 (예: 1번, 2번째, 3번 상품)
  const numericMatch = s.match(/(\d+)\s*번\s*(?:째|째\s*상품|째\s*항목|번째|거|것)?(?:\s|$)/);
  if (numericMatch) {
    const num = Number(numericMatch[1]);
    if (num >= 1) {
      const cleanedText = s.replace(numericMatch[0], ' ').replace(/^\s*(?:상품|항목|거|것)\s*/, ' ').replace(/\s+/g, ' ').trim();
      return { ordinalIndex: num - 1, cleanedText };
    }
  }

  return { ordinalIndex: null, cleanedText: s };
}

/**
 * 색상 및 별칭(Alias) 토큰 추출 및 치환
 */
export function resolveColorAlias(text, aliases = DEFAULT_COLOR_ALIASES) {
  const s = String(text || '').trim();
  if (!s) return null;
  const upper = s.toUpperCase();

  // 정확한 색상 코드 매칭
  for (const [alias, code] of Object.entries(aliases)) {
    if (upper === alias.toUpperCase() || upper === code) {
      return code;
    }
  }

  // 텍스트에 포함된 색상/별칭 키워드 탐색
  for (const [alias, code] of Object.entries(aliases)) {
    if (s.includes(alias) || upper.includes(code)) {
      return code;
    }
  }
  return null;
}

/**
 * 상품 코드에서 품번 가족 키 추출 ("P-160-REY-300" -> "P-160", "3331-SURTIDO-200" -> "3331")
 */
export function itemFamilyKey(itemCode) {
  const u = String(itemCode || '').toUpperCase();
  const letter = u.match(/^([A-Z]+-[A-Z0-9]+)/);
  if (letter) return letter[1];
  const num = u.match(/^(\d+)/);
  if (num) return num[1];
  return u;
}

/**
 * 후보군이 단일 품번 가족을 공유하는지 검사
 */
export function candidatesShareSingleFamily(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return false;
  const keys = new Set(
    candidates.map((item) => {
      const code = typeof item === 'object' ? String(item.code || item.name || item.id) : String(item);
      return itemFamilyKey(code);
    }).filter(Boolean)
  );
  return keys.size === 1;
}

/**
 * 3단계 스마트 역질문(Clarification Prompt) 생성 함수
 */
export function buildMultiCandidateClarificationPrompt(queryToken, candidates) {
  if (!candidates || !candidates.length) return '';
  const total = candidates.length;

  // Tier 1: 10개 초과 대량 후보
  if (total > 10) {
    return `${queryToken} 포함 상품이 ${total}개로 너무 많습니다. 영문자(예: P, L 등)나 규격을 함께 말씀해 주세요.`;
  }

  // Tier 2: 6~10개 후보 중 모두 SURTIDO(또는 동일 특성)인 경우
  const allSurtido = candidates.every(item => {
    const code = typeof item === 'object' ? String(item.code || item.name || item.id) : String(item);
    return code.toUpperCase().includes('SURTIDO');
  });
  if (total >= 6 && allSurtido) {
    return `기본 색상(SURTIDO) 상품이 ${total}가지 있습니다. 포장개수나 세부 번호를 함께 말씀해 주세요.`;
  }

  // Tier 3: 2~5개(또는 10개 이하 일반) 정밀 후보
  const sampleCount = Math.min(total, 5);
  const sampleCodes = candidates.slice(0, sampleCount).map(item => {
    return typeof item === 'object' ? String(item.code || item.name || item.id) : String(item);
  });
  return `${queryToken} 관련 상품이 ${total}가지 있습니다. 예: ${sampleCodes.join(', ')}. 어떤 상품을 조회할까요?`;
}

/**
 * 음성 인식 기반 리스트 인덱싱 매치 라이브러리 클래스
 * VoiceListMatcher
 */
export class VoiceListMatcher {
  constructor(items = [], options = {}) {
    this.idField = options.idField || 'id';
    this.indexFields = options.indexFields || ['code', 'name', 'item_name', 'item_code', 'label'];
    this.aliases = options.aliases || DEFAULT_COLOR_ALIASES;
    this.items = [];
    this.itemMap = new Map();
    this.index = null;

    if (items && items.length) {
      this.setItems(items);
    }
  }

  _normalizeItem(raw, idx) {
    if (typeof raw === 'string') {
      return {
        [this.idField]: idx,
        code: raw,
        name: raw,
        item_name: raw,
        _raw: raw,
        _listIndex: idx
      };
    }
    return {
      ...raw,
      code: raw.code || raw.item_code || raw.name || String(raw[this.idField] || ''),
      name: raw.name || raw.item_name || raw.code || String(raw[this.idField] || ''),
      _raw: raw,
      _listIndex: idx
    };
  }

  setItems(newItems = []) {
    this.items = newItems.map((item, idx) => this._normalizeItem(item, idx));
    this.itemMap.clear();

    this.index = new Document({
      document: {
        id: this.idField,
        index: this.indexFields,
        store: false
      },
      tokenize: 'full',
      cache: true,
      optimize: true
    });

    this.items.forEach((item) => {
      const idVal = item[this.idField];
      if (idVal != null) {
        this.itemMap.set(String(idVal), item);
        this.index.add(item);
      }
    });
  }

  addItem(rawItem) {
    const idx = this.items.length;
    const item = this._normalizeItem(rawItem, idx);
    const idVal = item[this.idField];
    if (idVal == null) return;

    if (this.itemMap.has(String(idVal))) {
      this.index.update(item);
    } else {
      this.items.push(item);
      this.index.add(item);
    }
    this.itemMap.set(String(idVal), item);
  }

  matchByOrdinal(ordinalIndex, candidateList = null) {
    const targetArray = candidateList || this.items;
    if (!targetArray || !targetArray.length) return null;

    let idx = ordinalIndex;
    if (idx === -1) {
      idx = targetArray.length - 1;
    }
    if (idx < 0 || idx >= targetArray.length) {
      return null;
    }
    return targetArray[idx];
  }

  _parseQueryToken(normalizedText, explicitColor) {
    const text = String(normalizedText || '').trim();
    const resolvedColor = resolveColorAlias(explicitColor || text, this.aliases);

    let codeToken = text;
    if (resolvedColor) {
      for (const [alias, code] of Object.entries(this.aliases)) {
        codeToken = codeToken.replace(new RegExp(alias, 'ig'), '').replace(new RegExp(code, 'ig'), '').trim();
      }
    }

    let prefix = '';
    const codeMatch = codeToken.match(/([A-Za-z]{1,4}-?\d+|\d{2,}(?:-\d+)?)/);
    if (codeMatch) {
      prefix = codeMatch[1];
    } else {
      prefix = codeToken.replace(/\s+/g, '');
    }

    return { prefix, resolvedColor, cleanText: codeToken };
  }

  _findCandidatesByCode(prefix, colorToken) {
    if (!prefix && !colorToken) return [];
    const upperPrefix = String(prefix || '').toUpperCase();

    let hits = this.items.filter((item) => {
      const u = String(item.code || item.name || '').toUpperCase();
      if (!upperPrefix) return true;
      if (u === upperPrefix || u.startsWith(`${upperPrefix}-`)) return true;
      if (/^\d+$/.test(upperPrefix)) {
        const numRegex = new RegExp(`(^|[^0-9])${upperPrefix}([^0-9]|$)`, 'i');
        return numRegex.test(u);
      }
      return u.includes(upperPrefix);
    });

    if (colorToken) {
      const colored = hits.filter((item) => {
        const u = String(item.code || item.name || '').toUpperCase();
        return u.includes(colorToken);
      });
      if (colored.length) {
        hits = colored;
      }
    }

    return hits;
  }

  _searchFlex(queryText, limit = 30) {
    if (!this.index || !queryText) return [];
    const rawResults = this.index.search(queryText, { limit });
    const seen = new Set();
    const results = [];
    for (const fieldResult of rawResults) {
      for (const id of fieldResult.result || []) {
        const key = String(id);
        if (seen.has(key)) continue;
        seen.add(key);
        const item = this.itemMap.get(key);
        if (item) results.push(item);
      }
    }
    return results;
  }

  match(spokenText, options = {}) {
    const raw = spokenNumeralsToDigits(String(spokenText || '').trim());
    if (!raw) {
      return {
        status: 'NO_MATCH',
        match: null,
        candidates: [],
        ordinalIndex: null,
        resolvedColor: null,
        normalizedQuery: '',
        prefix: null,
        clarificationPrompt: null
      };
    }

    let ordinalIndex = null;
    let queryWithoutOrdinal = raw;
    if (options.allowOrdinal !== false) {
      const ordResult = extractKoreanOrdinal(raw);
      ordinalIndex = ordResult.ordinalIndex;
      queryWithoutOrdinal = ordResult.cleanedText || '';
    }

    const { prefix, resolvedColor, cleanText } = this._parseQueryToken(
      queryWithoutOrdinal || raw,
      options.color
    );

    let candidates = [];
    if (prefix) {
      candidates = this._findCandidatesByCode(prefix, resolvedColor);
    }

    if (candidates.length === 0 && (cleanText || prefix)) {
      candidates = this._searchFlex(cleanText || prefix, 30);
      if (resolvedColor && candidates.length > 1) {
        const colored = candidates.filter((item) =>
          String(item.code || item.name || '').toUpperCase().includes(resolvedColor)
        );
        if (colored.length > 0) {
          candidates = colored;
        }
      }
    }

    if (ordinalIndex != null) {
      const targetPool = candidates.length > 0 ? candidates : this.items;
      const ordinalItem = this.matchByOrdinal(ordinalIndex, targetPool);
      if (ordinalItem) {
        return {
          status: 'ORDINAL_MATCH',
          match: ordinalItem._raw !== undefined ? ordinalItem._raw : ordinalItem,
          candidates: [ordinalItem._raw !== undefined ? ordinalItem._raw : ordinalItem],
          ordinalIndex,
          resolvedColor,
          normalizedQuery: raw,
          prefix,
          clarificationPrompt: null
        };
      }
    }

    if (candidates.length === 1) {
      const matched = candidates[0];
      return {
        status: 'EXACT_MATCH',
        match: matched._raw !== undefined ? matched._raw : matched,
        candidates: [matched._raw !== undefined ? matched._raw : matched],
        ordinalIndex: null,
        resolvedColor,
        normalizedQuery: raw,
        prefix,
        clarificationPrompt: null
      };
    }

    // 다중 후보: SURTIDO 자동 선택 규칙 (후보>5이고 단일 품번 가족일 때만, L-OP80 처럼 3개인 경우 역질문)
    if (candidates.length > 5 && !resolvedColor && options.autoPickSurtido !== false) {
      if (candidatesShareSingleFamily(candidates)) {
        const surtidoHits = candidates.filter((c) =>
          String(c.code || c.name || '').toUpperCase().includes('SURTIDO')
        );
        if (surtidoHits.length === 1) {
          const surtidoItem = surtidoHits[0];
          return {
            status: 'EXACT_MATCH',
            match: surtidoItem._raw !== undefined ? surtidoItem._raw : surtidoItem,
            candidates: candidates.map((c) => (c._raw !== undefined ? c._raw : c)),
            ordinalIndex: null,
            resolvedColor: 'SURTIDO',
            normalizedQuery: raw,
            prefix,
            clarificationPrompt: null
          };
        }
      }
    }

    if (candidates.length > 1) {
      const rawCandidates = candidates.map((c) => (c._raw !== undefined ? c._raw : c));
      const prompt = buildMultiCandidateClarificationPrompt(prefix || raw, rawCandidates);
      return {
        status: 'MULTIPLE_CANDIDATES',
        match: null,
        candidates: rawCandidates,
        ordinalIndex: null,
        resolvedColor,
        normalizedQuery: raw,
        prefix,
        clarificationPrompt: prompt
      };
    }

    return {
      status: 'NO_MATCH',
      match: null,
      candidates: [],
      ordinalIndex: null,
      resolvedColor,
      normalizedQuery: raw,
      prefix,
      clarificationPrompt: null
    };
  }
}

export function createVoiceListMatcher(items, options) {
  return new VoiceListMatcher(items, options);
}
