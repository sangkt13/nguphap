export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return res.status(500).json({ error: 'Missing GEMINI_API_KEY in Vercel environment variables.' });

    const { topicTitle, level, theorySummary, points, numQuestions } = req.body || {};
    const n = Number(numQuestions || 5);

    const prompt = `
You are an IELTS grammar quiz generator.

Topic: ${topicTitle}
Level: ${level}
Core formula: ${theorySummary}
Key notes:
${(points || []).map((p, i) => `${i + 1}. ${String(p).replace(/<[^>]*>/g, '')}`).join('\n')}

Generate ${n} multiple-choice questions.
Rules:
- Each question must test the grammar point accurately.
- Provide 4 options each.
- Exactly 1 correct option.
- Return ONLY valid JSON with this shape:
{"quiz":[{"question":"...","options":["A","B","C","D"],"correct":0}]}
No extra text.`;

    const url =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' +
      encodeURIComponent(key);

    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 1024 }
      })
    });

    if (!geminiRes.ok) {
      const t = await geminiRes.text();
      return res.status(500).json({ error: 'Gemini API error', detail: t });
    }

    const geminiData = await geminiRes.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const cleaned = text.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(cleaned);
    }

    if (!parsed?.quiz || !Array.isArray(parsed.quiz)) {
      return res.status(500).json({ error: 'Invalid quiz format from AI', raw: text });
    }

    parsed.quiz = parsed.quiz
      .map(q => ({
        question: String(q.question || '').trim(),
        options: Array.isArray(q.options) ? q.options.map(x => String(x)) : [],
        correct: Number(q.correct)
      }))
      .filter(q => q.question && q.options.length === 4 && Number.isInteger(q.correct) && q.correct >= 0 && q.correct <= 3);

    return res.status(200).json({ quiz: parsed.quiz });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', detail: e.message });
  }
}
