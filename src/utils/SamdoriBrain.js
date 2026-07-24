import axios from 'axios';

// SamdoriBrain.js
// Handles NLP via Gemini API for the Samdori Voice Assistant

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

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
export async function parseIntent(text) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API Key is missing. Please check .env file.');
  }

  const prompt = `
You are 'Samdori', an AI Voice Assistant for a Warehouse Management System (WMS).
Your job is to analyze the user's voice command and extract the intent and parameters as a strict JSON object.
Do not output anything other than the JSON object.

Supported intents:
1. "search": Checking stock for an item. (e.g. "재고 검색 P-160", "Busca P-160")
   Required fields: "intent": "search", "item": "<item_code>"
   
2. "add_order": Adding an item to the transfer cart. (e.g. "P-160 검정색 두 박스 추가해", "Agrega dos cajas de P-160 negro")
   Required fields: "intent": "add_order", "item": "<item_code>", "qty": <number>
   Optional fields: "color": "<color>"
   Note: Translate color to UPPERCASE SPANISH if possible (e.g. "검정색" -> "NEGRO", "하얀색" -> "BLANCO", "빨간색" -> "ROJO").
   
3. "check": Checking the current order list/cart. (e.g. "주문 리스트 확인해줘", "Revisa la lista")
   Required fields: "intent": "check"
   
4. "submit": Submitting or transmitting the order. (e.g. "주문 전송", "Enviar pedido")
   Required fields: "intent": "submit"

Extract the item code accurately. Users might say "피 백육십" (P 160) or "P-160". Normalize it to the closest likely item code format (e.g. "P-160").

User's Command: "${text}"
`;

  try {
    const response = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        response_mime_type: "application/json",
      }
    });

    const responseText = response.data.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(responseText);
    return parsed;
  } catch (error) {
    console.error('Samdori Brain Error:', error);
    throw error;
  }
}
