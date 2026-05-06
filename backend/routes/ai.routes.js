import express from 'express';
import adminKeyGuard from '../middleware/adminKeyGuard.js';

const router = express.Router();

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// POST /api/ai/describe
// Body: { productName, category, price, target }
// target: "both" | "short" | "full"
router.post('/describe', adminKeyGuard, async (req, res) => {
  const { productName, category, price, target = 'both' } = req.body;

  if (!productName?.trim()) {
    return res.status(400).json({ success: false, message: 'productName is required' });
  }

  if (!GEMINI_KEY) {
    return res.status(503).json({
      success: false,
      message: 'GEMINI_API_KEY is not configured on the server. Add it to the backend environment variables.',
    });
  }

  const productInfo = [
    `Product: ${productName}`,
    category ? `Category: ${category}` : '',
    price    ? `Price: ₹${price}`      : '',
  ].filter(Boolean).join(', ');

  const prompt =
    target === 'short'
      ? `Write a concise, punchy one-line marketing tagline (max 15 words) for: ${productInfo}. Return only the tagline, no quotes.`
      : target === 'full'
      ? `Write a compelling full product description (3–4 sentences, ~80 words) for an e-commerce website for: ${productInfo}. Include key features, benefits, and a call to action. Return only the description text.`
      : `Generate product copy for an e-commerce site for: ${productInfo}.
Return a JSON object with exactly two keys:
- "short": a catchy one-line tagline (max 15 words)
- "full": a compelling product description in 3–4 sentences (~80 words) with key features and a call to action.
Return ONLY the raw JSON object, no markdown, no code fences.`;

  try {
    const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.75, maxOutputTokens: 400 },
      }),
    });

    const geminiData = await geminiRes.json();

    if (!geminiRes.ok) {
      const errMsg = geminiData?.error?.message || 'Gemini API error';
      return res.status(502).json({ success: false, message: errMsg });
    }

    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    if (target === 'both') {
      try {
        const clean  = text.replace(/```json|```/gi, '').trim();
        const parsed = JSON.parse(clean);
        return res.json({ success: true, short: parsed.short || '', full: parsed.full || '' });
      } catch {
        // Fallback: put the whole text in full
        return res.json({ success: true, short: '', full: text });
      }
    }

    if (target === 'short') return res.json({ success: true, short: text, full: '' });
    return res.json({ success: true, short: '', full: text });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
