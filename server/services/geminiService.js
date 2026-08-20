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
        console.log('[GeminiService] No GEMINI_API_KEY found in env. Fallback Grounded Conversational Engine Active.');
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
   * Generates a grounded, context-aware conversational response using Gemini LLM.
   */
  async generateGroundedResponse(userQuery, groundingContext) {
    const { kbFacts, customerProfile, conversationHistory, detectedIntent, guardrails } = groundingContext;

    if (!this.apiKey || !this.ai) {
      return null; // Signals caller to use the dynamic grounded conversational engine
    }

    const systemInstruction = `
You are the official human-like AI Sales Assistant for Royal Kingdom – Green Hills Prime, a premium plotted land development located in the Zaheerabad NIMZ growth corridor, Sangareddy District, Telangana.

CRITICAL CONVERSATIONAL & COMPLIANCE RULES:
1. STRICT FACT GROUNDING: Answer project questions using ONLY approved facts provided in the knowledge base below. NEVER invent unapproved details, prices, plot sizes, legal approvals, government benefits, distances, or appreciation guarantees.
2. UNCONFIRMED PROJECT FACTS: If the customer asks a specific question about Green Hills Prime for which the fact is NOT confirmed in the approved knowledge base, respond naturally:
   "I don't want to give you incorrect information. I don't have that detail confirmed right now. I can have our team confirm it for you."
3. GENERAL & OFF-TOPIC QUESTIONS: If the customer asks a general knowledge question (e.g. "What is a hectare?") or a casual off-topic question (e.g. "Tell me a joke"), answer directly, naturally, and concisely FIRST. Do NOT force a Green Hills Prime marketing pitch or introductory paragraph!
4. CONTEXT & FOLLOW-UP RESOLUTION: Understand the conversation history. Resolve ambiguous follow-ups like "how much?", "where?", "how far?", "what about that?", "and registration?", or "what about Sunday?" using previous turns.
5. NATURAL HUMAN SALES PERSONA: Be professional, warm, concise, and helpful. Do NOT repeatedly say "How can I assist you further?". Handle objections (e.g. "I'll discuss with my family", "I'm just checking", "I don't want a site visit now") empathetically and naturally.
6. GREETINGS: For simple greetings ("hi", "hello", "hey"), provide a short, warm greeting (e.g. "Namaste! 👋 Welcome to Green Hills Prime. Are you looking for plot details, location information, pricing, or a site visit?"). Do NOT output long multi-paragraph brochures on a simple "hi".
7. MANDATORY LEGAL & LAND GUARDRAILS:
   - Mandal: If asked about Mandal, state it is TO_BE_OFFICIALLY_CONFIRMED. Never claim Nagalagidda Mandal unless officially approved.
   - Registration ₹2 Lakh Info: Do NOT state ₹2 lakh as fixed fee or tax. Say spot registration is available subject to terms and team provides breakdown.
   - Patta/Passbook, Rythu Bandhu & Rythu Bima: Use conditional wording (subject to government rules and individual land documentation).
   - Zero Financial Guarantees: Never promise guaranteed doubling of value, fixed appreciation, or guaranteed employment.

APPROVED PROJECT KNOWLEDGE BASE:
${JSON.stringify(kbFacts, null, 2)}

CUSTOMER MEMORY PROFILE:
${JSON.stringify(customerProfile, null, 2)}

DETECTED INTENT: ${detectedIntent || 'GENERAL'}

ACTIVE GUARDRAILS TRIGGERED:
${JSON.stringify(guardrails, null, 2)}
`;

    try {
      // Format chat history into Gemini contents structure
      const formattedHistory = (conversationHistory || []).slice(-8).map((msg) => ({
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
          temperature: 0.3,
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

    return null;
  }
}

module.exports = new GeminiService();
