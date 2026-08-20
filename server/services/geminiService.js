const { GoogleGenAI } = require('@google/genai');

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || null;
    this.ai = null;
    this.modelName = 'gemini-2.5-flash';
    this.initSdk();
  }

  initSdk() {
    try {
      if (this.apiKey) {
        this.ai = new GoogleGenAI({ apiKey: this.apiKey });
        console.log('[GeminiService] Real Google GenAI SDK initialized backend-only.');
      } else {
        console.log('[GeminiService] No GEMINI_API_KEY found in env. Fallback Knowledge Grounding Engine Active.');
      }
    } catch (err) {
      console.error('[GeminiService] SDK Initialization error:', err.message);
      this.ai = null;
    }
  }

  getStatus() {
    return {
      configured: Boolean(this.apiKey && this.ai),
      model: this.modelName,
      mode: this.apiKey && this.ai ? 'LIVE_REAL_GEMINI_LLM' : 'GROUNDED_FALLBACK_ENGINE'
    };
  }

  /**
   * Generates a grounded response using Gemini LLM or fallback engine.
   * Ensures strict adherence to approved Knowledge Base facts and guardrails.
   */
  async generateGroundedResponse(userQuery, groundingContext) {
    const { kbFacts, customerProfile, conversationHistory, matchedIntent, guardrails } = groundingContext;

    if (!this.apiKey || !this.ai) {
      return null; // Signals caller to use deterministic grounded pattern fallback
    }

    const systemInstruction = `
You are the official proactive AI Sales Assistant for Royal Kingdom – Green Hills Prime, a premium plotted land development located in the Zaheerabad NIMZ growth corridor, Sangareddy District, Telangana.

CRITICAL COMPLIANCE RULES:
1. STRICT FACT GROUNDING: Answer using ONLY approved facts provided below. NEVER invent unapproved details, prices, or exact legal guarantees.
2. SENSITIVE / LEGAL FACTS:
   - Mandatory Project Mandal: If asked about Mandal, state it is TO_BE_OFFICIALLY_CONFIRMED. Never claim Nagalagidda Mandal unless officially approved.
   - Registration ₹2 Lakh Info: Do NOT state ₹2 lakh as fixed registration fee, stamp duty, or total price. Say spot registration is available subject to terms and sales team provides plot breakdown.
   - Patta/Passbook, Rythu Bandhu & Rythu Bima: Use conditional wording (subject to government rules and individual land documentation).
   - Zero Financial Guarantees: Never promise guaranteed appreciation, returns, doubling of value, or guaranteed employment.
3. PERSONALIZATION & MEMORY:
   - Remember customer budget (e.g., ₹5 Lakhs) and purpose (investment vs home construction).
   - If customer expresses interest in visiting, offer a FREE site visit in company vehicle.
4. TONE & STYLE: Professional, welcoming, clear, and concise.

APPROVED KNOWLEDGE FACTS FOR THIS QUERY:
${JSON.stringify(kbFacts, null, 2)}

CUSTOMER MEMORY PROFILE:
${JSON.stringify(customerProfile, null, 2)}

ACTIVE GUARDRAILS TRIGGERED:
${JSON.stringify(guardrails, null, 2)}
`;

    try {
      // Format chat history into Gemini contents structure
      const formattedHistory = (conversationHistory || []).slice(-6).map((msg) => ({
        role: msg.sender_type === 'CUSTOMER' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      const contents = [
        ...formattedHistory,
        { role: 'user', parts: [{ text: userQuery }] }
      ];

      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.2, // Low temperature for high factual accuracy
          maxOutputTokens: 600
        }
      });

      if (response && response.text) {
        return {
          answer: response.text.trim(),
          model_used: this.modelName,
          mode: 'LIVE_GEMINI_SDK'
        };
      }
    } catch (err) {
      console.error('[GeminiService] Real Gemini API call error:', err.message);
    }

    return null; // Fallback to grounded rule engine on API error
  }
}

module.exports = new GeminiService();
