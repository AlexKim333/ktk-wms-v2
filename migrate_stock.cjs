const fs = require('fs');
const axios = require('axios');

// === 설정 (Settings) ===
const FRAPPE_URL = 'http://localhost:8000'; // 프라페 서버 URL
const FRAPPE_USER = 'Administrator';
const FRAPPE_PASS = 'admin';

// 읽어들일 CSV 파일 경로
const CSV_FILE_PATH = 'stock_data.csv'; 

// ========================

async function migrateStock() {
  try {
    console.log("1. Frappe 서버 로그인 중...");
    const frappeApi = axios.create({
      baseURL: FRAPPE_URL,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    const loginRes = await frappeApi.post('/api/method/login', {
      usr: FRAPPE_USER,
      pwd: FRAPPE_PASS
    });
    
    const cookies = loginRes.headers['set-cookie'];
    if (cookies) {
      frappeApi.defaults.headers['Cookie'] = cookies.join('; ');
    }
    console.log("   -> 로그인 성공!");

    console.log("2. CSV 파일 읽기...");
    if (!fs.existsSync(CSV_FILE_PATH)) {
      console.error(`[오류] ${CSV_FILE_PATH} 파일을 찾을 수 없습니다.`);
      console.log(`CSV 파일 양식 예시:\nitem_code,warehouse,qty\nITEM-001,MAIN WAREHOUSE,100`);
      return;
    }

    const csvData = fs.readFileSync(CSV_FILE_PATH, 'utf8');
    const lines = csvData.split(/\r?\n/).filter(line => line.trim() !== '');
    
    // 첫 줄은 헤더(item_code, warehouse, qty)라고 가정
    const items = [];
    for (let i = 1; i < lines.length; i++) {
      const [item_code, warehouse, qty] = lines[i].split(',').map(s => s.trim());
      if (item_code && warehouse && qty && !isNaN(Number(qty))) {
        items.push({
          item_code: item_code,
          t_warehouse: warehouse,
          qty: Number(qty),
          // Material Receipt시 단가가 필요할 수 있으므로, 0을 허용하거나 임의로 지정합니다.
          // allow_zero_valuation_rate 설정을 켜줍니다.
          allow_zero_valuation_rate: 1
        });
      }
    }

    if (items.length === 0) {
      console.log("   -> 업로드할 유효한 재고 데이터가 없습니다.");
      return;
    }
    console.log(`   -> 총 ${items.length}건의 아이템 수량을 인식했습니다.`);

    console.log("3. Material Receipt (기초재고 입고) 전표 생성 중...");
    
    // Frappe Stock Entry (Material Receipt) 페이로드 구성
    const payload = {
      docstatus: 1, // 1: 즉시 Submit(확정)
      stock_entry_type: 'Material Receipt',
      items: items
    };

    const res = await frappeApi.post('/api/resource/Stock Entry', payload);
    
    if (res.data && res.data.data) {
      console.log(`\n🎉 성공적으로 기초재고 전표가 등록(Submit) 되었습니다!`);
      console.log(`전표 번호(Name): ${res.data.data.name}`);
    }

  } catch (error) {
    console.error("\n❌ 기초재고 등록 실패:");
    if (error.response && error.response.data) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

migrateStock();
