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
    contextPrompt = `
CONVERSATION CONTEXT (MEMORY):
The user recently interacted with the item: "${lastIntent.item}".
If the user's command contains pronouns like "이거", "이것", "그거", "그것" (this/that) without explicitly naming a product, you MUST ASSUME they are referring to "${lastIntent.item}".
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
   
2. "add_order": Adding an item to the transfer cart. (e.g. "P-160 검정 색 두 박스 장바구니에 담아", "Agrega dos cajas de P-160 negro")
   Required fields: "intent": "add_order", "item": "<item_code>", "qty": <number>
   Optional fields: "color": "<color>"
   Note: Translate color to UPPERCASE SPANISH if possible (e.g. "검정색" -> "NEGRO", "하얀색" -> "BLANCO", "빨간색" -> "ROJO").
   
3. "check": Checking the current order list/cart. (e.g. "주문 리스트 확인해줘", "Revisa la lista")
   Required fields: "intent": "check"
   
4. "submit": Submitting or transmitting the order. (e.g. "주문 전송", "Enviar pedido")
   Required fields: "intent": "submit"

Extract the item code accurately. Users might say "피 백육십" (P 160) or "P-160". Normalize it to the closest likely item code format (e.g. "P-160").
Note: The speech-to-text engine might mishear words. For example, "주문 리스트" (Order list) might be misheard as "휴먼 리스트" (Human list), and "전송" might be heard as "청송". Be lenient and infer the correct intent based on the context.
Also note that users might mix Korean and Spanish (e.g., "P-160 네그로", where '네그로' is Negro). Understand that '네그로' means 'black' or 'NEGRO'.
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
