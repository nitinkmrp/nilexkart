import express from 'express';
import roleGuard from '../middleware/roleGuard.js';

const router = express.Router();

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// POST /api/ai/describe
// Body: { productName, category, price, target }
// target: "both" | "short" | "full"
router.post('/describe', roleGuard(['admin', 'editor']), async (req, res) => {
  const { productName, category, price, target = 'both' } = req.body;

  if (!productName?.trim()) {
    return res.status(400).json({ success: false, message: 'productName is required' });
  }

  if (!OPENROUTER_KEY) {
    return res.status(503).json({
      success: false,
      message: 'OPENROUTER_API_KEY is not configured on the server. Add it to the backend environment variables.',
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
    const openRouterRes = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_KEY}`
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash', // You can change this to any OpenRouter model like 'openai/gpt-4o-mini'
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.75
      }),
    });

    const openRouterData = await openRouterRes.json();

    if (!openRouterRes.ok) {
      const errMsg = openRouterData?.error?.message || 'OpenRouter API error';
      return res.status(502).json({ success: false, message: errMsg });
    }

    const text = openRouterData?.choices?.[0]?.message?.content?.trim() || '';

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

// POST /api/ai/generate-prompt
// Body: { productName, category }
router.post('/generate-prompt', roleGuard(['admin', 'editor']), async (req, res) => {
  const { productName, category } = req.body;

  if (!productName?.trim()) {
    return res.status(400).json({ success: false, message: 'productName is required' });
  }

  // Use either Gemini or OpenRouter (we'll stick to OpenRouter here since it's already set up above)
  if (!OPENROUTER_KEY) {
    return res.status(503).json({
      success: false,
      message: 'Missing API keys. Please ensure OPENROUTER_API_KEY is configured.',
    });
  }

  try {
    // 1. Generate a descriptive prompt using OpenRouter/Gemini
    const productInfo = `${productName} ${category ? `(Category: ${category})` : ''}`;
    const promptText = `Create a highly detailed, descriptive image generation prompt for an e-commerce product: ${productInfo}. 
The image should be a professional studio product photography shot, clean background, highly detailed. 
Return ONLY the prompt text, no quotes or markdown. Max 50 words.`;

    const openRouterRes = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_KEY}`
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: promptText }],
        temperature: 0.7,
        max_tokens: 100
      }),
    });
    
    const openRouterData = await openRouterRes.json();
    if (!openRouterRes.ok) {
      throw new Error(openRouterData?.error?.message || 'Failed to generate prompt via AI');
    }
    const generatedPrompt = openRouterData?.choices?.[0]?.message?.content?.trim();

    if (!generatedPrompt) {
      throw new Error('AI returned an empty prompt');
    }

    return res.json({ success: true, prompt: generatedPrompt });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
