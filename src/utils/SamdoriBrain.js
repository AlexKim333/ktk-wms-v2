import axios from 'axios';
import FlexSearch from 'flexsearch';

let flexIndex = null;
let lastValidItemsLength = -1;

function initFlexSearch(validItems) {
  if (!validItems || validItems.length === 0) return;
  if (flexIndex && lastValidItemsLength === validItems.length) return;
  flexIndex = new FlexSearch.Document({
    document: {
      id: 'id',
      index: ['code']
    },
    tokenize: 'forward'
  });
  validItems.forEach((item, idx) => {
    flexIndex.add({ id: idx, code: item });
  });
  lastValidItemsLength = validItems.length;
}

function matchItemCode(rawSpoken, color, validItems) {
  if (!rawSpoken) return null;
  initFlexSearch(validItems);
  if (!flexIndex) return rawSpoken;
  const query = `${rawSpoken} ${color || ''}`.trim();
  const results = flexIndex.search(query, 1);
  if (results.length > 0 && results[0].result.length > 0) {
    const idx = results[0].result[0];
    return validItems[idx];
  }
  return rawSpoken;
}

// SamdoriBrain.js
// Handles NLP via Gemini API for the Samdori Voice Assistant

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent';

/**
 * Sends transcribed text to Gemini API to extract intent.
 * 
 * Intents:
 * - search: { intent: 'search', item: 'P-160' }
 * - add_order: { intent: 'add_order', item: 'P-160', color: 'NEGRO', qty: 2 }
 * - check: { intent: 'check' }
 * - submit: { intent: 'submit' }
 * 
 * @param {string} text - User's voice transcribed text
 * @returns {Promise<Object>} - The parsed intent object
 */
export async function parseIntent(text, validItems = [], lastIntent = null) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API Key is missing. Please check .env file.');
  }


  let contextPrompt = ''
  if (lastIntent && lastIntent.item) {
    const lastAction = lastIntent.intent || 'unknown'
    contextPrompt = `
CONVERSATION CONTEXT (MEMORY) — CRITICAL FOR 2-STEP FLOW:
The user recently used item: "${lastIntent.item}" (last intent: "${lastAction}").
Typical warehouse flow with Push-To-Talk (two separate button presses):
  1) search/품명검색 for a product
  2) then add N boxes(불또) to cart WITHOUT repeating the full item code

When the current command is ONLY about quantity + cart verbs (담아/넣어/추가/불또/박스) and does NOT clearly name a different item code,
you MUST set raw_spoken_item="${lastIntent.item}".

Treat ALL of the following as referring to "${lastIntent.item}":
- Pronouns: "이거", "이것", "그거", "그것", "얘", "this", "that", "eso", "este", "esta"
- Recall: "아까", "방금", "이전", "조회했던", "조회한", "검색한", "확인한", "품명검색한", "그 제품", "그 품목", "아까 거", "방금 본 거"
- Spanish: "el de antes", "el que busqué", "ese producto", "el anterior", "el mismo"
- Even SHORT commands with NO item noun: "두 불또 담아줘", "한박스 넣어줘", "3불또 추가해", "장바구니에 두 개 넣어"

Examples that MUST resolve raw_spoken_item to "${lastIntent.item}":
- "두 불또 장바구니에 넣어줘" -> {"intent":"add_order","raw_spoken_item":"${lastIntent.item}","qty":2}
- "한불또 담아줘" -> {"intent":"add_order","raw_spoken_item":"${lastIntent.item}","qty":1}
- "3박스 추가해" -> {"intent":"add_order","raw_spoken_item":"${lastIntent.item}","qty":3}
- "그거 재고 다시" -> {"intent":"search","raw_spoken_item":"${lastIntent.item}"}

WAREHOUSE FOLLOW-UP (admin often asked "which warehouse?"):
If the user answers with ONLY a warehouse/branch name (no new item code), return:
{"intent":"search","raw_spoken_item":"${lastIntent.item}","warehouse":"<name>"}
Examples: "알라르꼰", "까르멘", "Alarcón", "Carmen", "본사", "지점" -> search same item + warehouse.

Only ignore this memory if the user clearly names a DIFFERENT explicit item code in the current command.
`
  }

  const promptCore = `
You are an AI Voice Assistant for a Warehouse Management System (WMS). Your name is 'Samdori' (in Korean) or 'Paquito' (in Spanish).
Your job is to analyze the user's voice command and extract the intent and parameters as a strict JSON object.
Do not output anything other than the JSON object.
${contextPrompt}
Supported intents:
1. "search": Product / stock lookup (품명검색, 재고조회).
   Treat ALL of these as "search":
   - "품명검색", "품명 검색", "검색해줘", "찾아줘", "조회해줘", "재고 확인", "재고조회", "몇 개야", "몇개나 있어"
   - Spanish: "Busca", "Inventario", "Stock de"
   Examples: "품명검색 P-160", "P-160 검색", "P-160 검정 재고 확인해줘", "Busca P-160 negro"
   Required fields: "intent": "search", "raw_spoken_item": "<what_the_user_said>"
   Optional fields: "warehouse": "<warehouse_name>" (e.g. "알라르꼰" -> "ALARCON", "까르멘" -> "CARMEN")
   Optional fields: "color": "<color>" (UPPERCASE Spanish if possible)
   
2. "add_order": ONE unified action = add item into the shopping cart (장바구니 담기).
   Treat ALL of these as the SAME intent "add_order":
   - "장바구니에 담아/넣어/추가해", "카트에 넣어", "주문에 추가", "담아줘", "넣어줘", "추가해줘", "담아", "넣어", "추가"
   - Spanish: "agrega", "añade", "pon en el carrito", "agregar al carrito"
   Examples:
   - "P-160 검정 두 박스 장바구니에 담아" -> add_order qty=2
   - "두 불또 추가해줘" (with memory item) -> add_order that memory item, qty=2
   Required fields: "intent": "add_order", "raw_spoken_item": "<what_the_user_said>", "qty": <number>
   Optional fields: "color": "<color>"
   Note: Translate color to UPPERCASE SPANISH if possible (e.g. "검정색" -> "NEGRO", "하얀색" -> "BLANCO", "빨간색" -> "ROJO").
   If qty is missing, default qty to 1.
   qty means NUMBER OF BOXES (불또/박스), NOT eaches, unless the user clearly says 낱개/개/pieza.
   
3. "check": Checking what is ALREADY in the cart (장바구니 조회). NOT adding.
   Treat ALL of these as "check":
   - "장바구니 확인해줘", "장바구니 조회", "카트 확인해", "뭐 담겨 있어?", "뭐 들어있어?", "주문 리스트 확인해줘", "리스트 보여줘"
   - Spanish: "Revisa el carrito", "Revisa la lista", "Qué hay en el carrito?"
   Required fields: "intent": "check"
   
4. "submit": Submitting / transmitting the cart order to Frappe (ERP).
   Treat ALL of these as the SAME intent "submit":
   - "주문 전송", "전송해줘", "전송", "올려줘", "발주 올려", "프라페 전송", "Frappe 전송", "ERP 전송", "제출해줘", "보내줘"
   - STT mishears: "청송", "전송해", "프라빼 전송", "푸라페 전송" → still "submit"
   - Spanish: "Enviar pedido", "Envía el pedido", "Manda el pedido", "Confirma el pedido"
   Required fields: "intent": "submit"

5. "none": If the user's command is just meaningless background noise, incomplete chatter, or lacks any clear WMS action (e.g. check, add, submit, search), DO NOT force an intent. Simply output {"intent": "none"}

CRITICAL RULE FOR raw_spoken_item:
You NO LONGER need to output a valid full item code. Simply extract exactly what the user sounded out phonetically for the item name (e.g. "피 백육십", "P 160", "P-160").
The frontend will handle searching the actual database.
  Also note that users might mix Korean and Spanish (e.g., "P-160 네그로", where '네그로' is Negro). Understand that '네그로' means 'black' or 'NEGRO'.
  CRITICAL: The word "불또" (or "bulto", "불도", "불독", "불꽃") is a Kopanish/Spanish keyword meaning "Box" (박스). 
  When users say "<number>불또" (e.g., "한불또", "1불또", "두불또", "세불또", "un bulto", "이불또"), you must carefully extract the exact number as "qty". 
  Korean counters: 한/일/하나=1, 두/이/둘=2, 세/삼/셋=3, 네/사/넷=4, 다섯/오=5. (e.g., "한불또" means qty: 1. "두불또" means qty: 2).
`
  
  const prompt = promptCore + `

User's Command: "${text}"
`;
try {
    const response = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        response_mime_type: "application/json",
      }
    });

    const partText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!partText) {
      throw new Error('Gemini returned empty candidates (blocked or no content).');
    }
    let responseText = partText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(responseText);
    
// Add token usage metadata
    if (response.data.usageMetadata) {
      parsed._tokenUsage = response.data.usageMetadata;
    }
    
    // FlexSearch local matching
    if (parsed.raw_spoken_item) {
      const matched = matchItemCode(parsed.raw_spoken_item, parsed.color, validItems);
      if (matched) {
        parsed.item = matched;
      } else {
        parsed.item = parsed.raw_spoken_item;
      }
    }
    
    return parsed;
  } catch (error) {
    console.error('Samdori Brain Error:', error);
    throw error;
  }
}

/**
 * Sends audio data to Gemini API to extract intent (Multimodal).
 */
export async function parseIntentFromAudio(base64Audio, mimeType, validItems = [], lastIntent = null) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API Key is missing. Please check .env file.');
  }


  let contextPrompt = ''
  if (lastIntent && lastIntent.item) {
    const lastAction = lastIntent.intent || 'unknown'
    contextPrompt = `
CONVERSATION CONTEXT (MEMORY) — CRITICAL FOR 2-STEP FLOW:
The user recently used item: "${lastIntent.item}" (last intent: "${lastAction}").
Typical warehouse flow with Push-To-Talk (two separate button presses):
  1) search/품명검색 for a product
  2) then add N boxes(불또) to cart WITHOUT repeating the full item code

When the current command is ONLY about quantity + cart verbs (담아/넣어/추가/불또/박스) and does NOT clearly name a different item code,
you MUST set raw_spoken_item="${lastIntent.item}".

Treat ALL of the following as referring to "${lastIntent.item}":
- Pronouns: "이거", "이것", "그거", "그것", "얘", "this", "that", "eso", "este", "esta"
- Recall: "아까", "방금", "이전", "조회했던", "조회한", "검색한", "확인한", "품명검색한", "그 제품", "그 품목", "아까 거", "방금 본 거"
- Spanish: "el de antes", "el que busqué", "ese producto", "el anterior", "el mismo"
- Even SHORT commands with NO item noun: "두 불또 담아줘", "한박스 넣어줘", "3불또 추가해", "장바구니에 두 개 넣어"

Examples that MUST resolve raw_spoken_item to "${lastIntent.item}":
- "두 불또 장바구니에 넣어줘" -> {"intent":"add_order","raw_spoken_item":"${lastIntent.item}","qty":2}
- "한불또 담아줘" -> {"intent":"add_order","raw_spoken_item":"${lastIntent.item}","qty":1}
- "3박스 추가해" -> {"intent":"add_order","raw_spoken_item":"${lastIntent.item}","qty":3}
- "그거 재고 다시" -> {"intent":"search","raw_spoken_item":"${lastIntent.item}"}

WAREHOUSE FOLLOW-UP (admin often asked "which warehouse?"):
If the user answers with ONLY a warehouse/branch name (no new item code), return:
{"intent":"search","raw_spoken_item":"${lastIntent.item}","warehouse":"<name>"}
Examples: "알라르꼰", "까르멘", "Alarcón", "Carmen", "본사", "지점" -> search same item + warehouse.

Only ignore this memory if the user clearly names a DIFFERENT explicit item code in the current command.
`
  }

  const promptCore = `
You are an AI Voice Assistant for a Warehouse Management System (WMS). Your name is 'Samdori' (in Korean) or 'Paquito' (in Spanish).
Your job is to analyze the user's voice command and extract the intent and parameters as a strict JSON object.
Do not output anything other than the JSON object.
${contextPrompt}
Supported intents:
1. "search": Product / stock lookup (품명검색, 재고조회).
   Treat ALL of these as "search":
   - "품명검색", "품명 검색", "검색해줘", "찾아줘", "조회해줘", "재고 확인", "재고조회", "몇 개야", "몇개나 있어"
   - Spanish: "Busca", "Inventario", "Stock de"
   Examples: "품명검색 P-160", "P-160 검색", "P-160 검정 재고 확인해줘", "Busca P-160 negro"
   Required fields: "intent": "search", "raw_spoken_item": "<what_the_user_said>"
   Optional fields: "warehouse": "<warehouse_name>" (e.g. "알라르꼰" -> "ALARCON", "까르멘" -> "CARMEN")
   Optional fields: "color": "<color>" (UPPERCASE Spanish if possible)
   
2. "add_order": ONE unified action = add item into the shopping cart (장바구니 담기).
   Treat ALL of these as the SAME intent "add_order":
   - "장바구니에 담아/넣어/추가해", "카트에 넣어", "주문에 추가", "담아줘", "넣어줘", "추가해줘", "담아", "넣어", "추가"
   - Spanish: "agrega", "añade", "pon en el carrito", "agregar al carrito"
   Examples:
   - "P-160 검정 두 박스 장바구니에 담아" -> add_order qty=2
   - "두 불또 추가해줘" (with memory item) -> add_order that memory item, qty=2
   Required fields: "intent": "add_order", "raw_spoken_item": "<what_the_user_said>", "qty": <number>
   Optional fields: "color": "<color>"
   Note: Translate color to UPPERCASE SPANISH if possible (e.g. "검정색" -> "NEGRO", "하얀색" -> "BLANCO", "빨간색" -> "ROJO").
   If qty is missing, default qty to 1.
   qty means NUMBER OF BOXES (불또/박스), NOT eaches, unless the user clearly says 낱개/개/pieza.
   
3. "check": Checking what is ALREADY in the cart (장바구니 조회). NOT adding.
   Treat ALL of these as "check":
   - "장바구니 확인해줘", "장바구니 조회", "카트 확인해", "뭐 담겨 있어?", "뭐 들어있어?", "주문 리스트 확인해줘", "리스트 보여줘"
   - Spanish: "Revisa el carrito", "Revisa la lista", "Qué hay en el carrito?"
   Required fields: "intent": "check"
   
4. "submit": Submitting / transmitting the cart order to Frappe (ERP).
   Treat ALL of these as the SAME intent "submit":
   - "주문 전송", "전송해줘", "전송", "올려줘", "발주 올려", "프라페 전송", "Frappe 전송", "ERP 전송", "제출해줘", "보내줘"
   - STT mishears: "청송", "전송해", "프라빼 전송", "푸라페 전송" → still "submit"
   - Spanish: "Enviar pedido", "Envía el pedido", "Manda el pedido", "Confirma el pedido"
   Required fields: "intent": "submit"

5. "none": If the user's command is just meaningless background noise, incomplete chatter, or lacks any clear WMS action (e.g. check, add, submit, search), DO NOT force an intent. Simply output {"intent": "none"}

CRITICAL RULE FOR raw_spoken_item:
You NO LONGER need to output a valid full item code. Simply extract exactly what the user sounded out phonetically for the item name (e.g. "피 백육십", "P 160", "P-160").
The frontend will handle searching the actual database.
  Also note that users might mix Korean and Spanish (e.g., "P-160 네그로", where '네그로' is Negro). Understand that '네그로' means 'black' or 'NEGRO'.
  CRITICAL: The word "불또" (or "bulto", "불도", "불독", "불꽃") is a Kopanish/Spanish keyword meaning "Box" (박스). 
  When users say "<number>불또" (e.g., "한불또", "1불또", "두불또", "세불또", "un bulto", "이불또"), you must carefully extract the exact number as "qty". 
  Korean counters: 한/일/하나=1, 두/이/둘=2, 세/삼/셋=3, 네/사/넷=4, 다섯/오=5. (e.g., "한불또" means qty: 1. "두불또" means qty: 2).
`
  
  const prompt = promptCore + `

The user's command is provided as the attached audio file.
`;
try {
    const response = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      contents: [{
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Audio
            }
          }
        ]
      }],
      generationConfig: {
        response_mime_type: "application/json",
      }
    });

    const partText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!partText) {
      throw new Error('Gemini audio returned empty candidates (blocked, unsupported mime, or no content).');
    }
    let responseText = partText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(responseText);
    
// Add token usage metadata
    if (response.data.usageMetadata) {
      parsed._tokenUsage = response.data.usageMetadata;
    }
    
    // FlexSearch local matching
    if (parsed.raw_spoken_item) {
      const matched = matchItemCode(parsed.raw_spoken_item, parsed.color, validItems);
      if (matched) {
        parsed.item = matched;
      } else {
        parsed.item = parsed.raw_spoken_item;
      }
    }
    
    return parsed;
  } catch (error) {
    console.error('Samdori Brain Audio Error:', error);
    throw error;
  }
}

