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

// POST /api/ai/generate-image
// Body: { productName, category }
router.post('/generate-image', roleGuard(['admin', 'editor']), async (req, res) => {
  const { productName, category } = req.body;

  if (!productName?.trim()) {
    return res.status(400).json({ success: false, message: 'productName is required' });
  }

  const ADOBE_CLIENT_ID = process.env.ADOBE_CLIENT_ID || '';
  const ADOBE_CLIENT_SECRET = process.env.ADOBE_CLIENT_SECRET || '';

  if (!GEMINI_KEY || !ADOBE_CLIENT_ID || !ADOBE_CLIENT_SECRET) {
    return res.status(503).json({
      success: false,
      message: 'Missing API keys. Please ensure GEMINI_API_KEY, ADOBE_CLIENT_ID, and ADOBE_CLIENT_SECRET are configured.',
    });
  }

  try {
    // 1. Generate a descriptive prompt using Gemini
    const productInfo = `${productName} ${category ? `(Category: ${category})` : ''}`;
    const geminiPrompt = `Create a highly detailed, descriptive image generation prompt for an e-commerce product: ${productInfo}. 
The image should be a professional studio product photography shot, clean background, 4k resolution, highly detailed. 
Return ONLY the prompt text, no quotes or markdown. Max 100 words.`;

    const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: geminiPrompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 200 },
      }),
    });
    
    const geminiData = await geminiRes.json();
    if (!geminiRes.ok) {
      throw new Error(geminiData?.error?.message || 'Failed to generate prompt via Gemini');
    }
    const generatedPrompt = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!generatedPrompt) {
      throw new Error('Gemini returned an empty prompt');
    }

    // 2. Authenticate with Adobe IMS
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', ADOBE_CLIENT_ID);
    params.append('client_secret', ADOBE_CLIENT_SECRET);
    params.append('scope', 'openid,AdobeID,firefly_api');

    const authRes = await fetch('https://ims-na1.adobelogin.com/ims/token/v3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const authData = await authRes.json();
    if (!authRes.ok) {
      throw new Error(authData.error_description || 'Adobe Authentication Failed');
    }
    const accessToken = authData.access_token;

    // 3. Generate Image with Adobe Firefly
    const fireflyRes = await fetch('https://firefly-api.adobe.io/v3/images/generate', {
      method: 'POST',
      headers: {
        'x-api-key': ADOBE_CLIENT_ID,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: generatedPrompt,
        n: 1,
        size: { width: 1024, height: 1024 }
      }),
    });

    const fireflyData = await fireflyRes.json();
    if (!fireflyRes.ok) {
      throw new Error(fireflyData.message || 'Adobe Firefly API Error');
    }

    // fireflyData.outputs[0].image.url or similar depending on the exact Firefly v3 spec
    // Adobe Firefly usually returns presigned URL in 'outputs'
    const imageUrl = fireflyData?.outputs?.[0]?.image?.url || fireflyData?.outputs?.[0]?.image?.uploadUrl;

    if (!imageUrl) {
      throw new Error('Firefly generated response but no image URL was found');
    }

    return res.json({ success: true, prompt: generatedPrompt, imageUrl });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
