import axios from 'axios';

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

  let validItemsPrompt = ''
  if (validItems.length > 0) {
    validItemsPrompt = `
Here is a list of VALID full item codes currently available in the warehouse:
[${validItems.join(', ')}]

CRITICAL RULE FOR ITEM CODES:
When the user speaks an item (e.g., "B-160") and optionally a color (e.g., "검정", "까만색"), you MUST search this list for the closest matching FULL item code (e.g., "P-160-NEGRO-400") and output that EXACT FULL code.
Never output a partial code like "P-160" if a full code like "P-160-NEGRO-400" exists in the list and matches the user's color description.
`
  }

  let contextPrompt = ''
  if (lastIntent && lastIntent.item) {
    const lastAction = lastIntent.intent || 'unknown'
    contextPrompt = `
CONVERSATION CONTEXT (MEMORY):
The user recently interacted with the item: "${lastIntent.item}" (last action intent: "${lastAction}").
You MUST reuse "${lastIntent.item}" as the "item" field when the user refers to that product WITHOUT stating a full new item code.

Treat ALL of the following as referring to "${lastIntent.item}":
- Pronouns: "이거", "이것", "그거", "그것", "얘", "this", "that", "eso", "este", "esta"
- Recall phrases (Korean): "아까", "방금", "이전", "조회했던", "조회한", "검색한", "확인한", "그 제품", "그 품목", "그거", "아까 거", "아까 조회했던 것/거", "방금 본 거"
- Recall phrases (Spanish): "el de antes", "el que busqué", "el que consulté", "ese producto", "el anterior", "el mismo"

Examples that MUST resolve item to "${lastIntent.item}":
- "아까 조회했던 거 한불또 장바구니에 넣어줘" -> add_order, item="${lastIntent.item}", qty=1
- "방금 그거 두 박스 담아줘" -> add_order, item="${lastIntent.item}", qty=2
- "그 제품 재고 다시 확인해줘" -> search, item="${lastIntent.item}"

Only ignore this memory if the user clearly names a DIFFERENT explicit item code in the current command.
`
  }

  const prompt = `
You are an AI Voice Assistant for a Warehouse Management System (WMS). Your name is 'Samdori' (in Korean) or 'Paquito' (in Spanish).
Your job is to analyze the user's voice command and extract the intent and parameters as a strict JSON object.
Do not output anything other than the JSON object.
${contextPrompt}
Supported intents:
1. "search": Checking stock or inventory for an item. (e.g. "재고 확인 P-160", "재고조회 P-160", "P-160 몇개나 있어?", "Busca P-160", "Inventario P-160", "알라르꼰에 P-160 몇개야?")
   Required fields: "intent": "search", "item": "<item_code>"
   Optional fields: "warehouse": "<warehouse_name>" (Extract the target warehouse if mentioned, e.g. "알라르꼰" -> "ALARCON", "까르멘" -> "CARMEN", etc.)
   
2. "add_order": ONE unified action = add item into the shopping cart (장바구니 담기).
   Treat ALL of these as the SAME intent "add_order" (do NOT invent a separate "add" intent):
   - "장바구니에 담아/넣어/추가해", "카트에 넣어", "주문에 추가", "담아줘", "넣어줘", "추가해줘"
   - Spanish: "agrega", "añade", "pon en el carrito", "agregar al carrito"
   Examples: "P-160 검정 두 박스 장바구니에 담아", "P-160-NEGRO-400 1개 추가해줘", "Agrega dos cajas de P-160 negro"
   Required fields: "intent": "add_order", "item": "<item_code>", "qty": <number>
   Optional fields: "color": "<color>"
   Note: Translate color to UPPERCASE SPANISH if possible (e.g. "검정색" -> "NEGRO", "하얀색" -> "BLANCO", "빨간색" -> "ROJO").
   If qty is missing, default qty to 1.
   
3. "check": Checking what is ALREADY in the cart (장바구니 조회). NOT adding.
   Examples: "장바구니 확인해줘", "장바구니 조회", "뭐 담겨 있어?", "주문 리스트 확인해줘", "Revisa el carrito", "Revisa la lista"
   Required fields: "intent": "check"
   
4. "submit": Submitting or transmitting the order. (e.g. "주문 전송", "Enviar pedido")
   Required fields: "intent": "submit"

5. "none": If the user's command is just meaningless background noise, incomplete chatter, or lacks any clear WMS action (e.g. check, add, submit, search), DO NOT force an intent. Simply output {"intent": "none"}

Extract the item code accurately. Users might say "피 백육십" (P 160) or "P-160". Normalize it to the closest likely item code format (e.g. "P-160").
Note: The speech-to-text engine might mishear words. For example, "주문 리스트" (Order list) might be misheard as "휴먼 리스트" (Human list), and "전송" might be heard as "청송". Be lenient and infer the correct intent based on the context.
  Also note that users might mix Korean and Spanish (e.g., "P-160 네그로", where '네그로' is Negro). Understand that '네그로' means 'black' or 'NEGRO'.
  CRITICAL: The word "불또" (or "bulto", "불도", "불독", "불꽃") is a Kopanish/Spanish keyword meaning "Box" (박스). 
  When users say "<number>불또" (e.g., "한불또", "1불또", "두불또", "세불또", "un bulto", "이불또"), you must carefully extract the exact number as "qty". 
  Korean counters: 한/일/하나=1, 두/이/둘=2, 세/삼/셋=3, 네/사/넷=4, 다섯/오=5. (e.g., "한불또" means qty: 1. "두불또" means qty: 2).
  You must understand highly natural, conversational language. Don't be strict about exact phrases; infer the intent from the overall sentence.
${validItemsPrompt}

User's Command: "${text}"
`;

  try {
    const response = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        response_mime_type: "application/json",
      }
    });

    let responseText = response.data.candidates[0].content.parts[0].text;
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(responseText);
    return parsed;
  } catch (error) {
    console.error('Samdori Brain Error:', error);
    throw error;
  }
}
