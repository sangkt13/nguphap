export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {

    const key = process.env.OPENAI_API_KEY;

    if (!key) {
      return res.status(500).json({
        error: "Missing OPENAI_API_KEY in Vercel Environment Variables"
      });
    }

    const { topicTitle, level, theorySummary, points, numQuestions } = req.body;

    const n = Number(numQuestions || 5);

    const prompt = `
You are an IELTS grammar quiz generator.

Topic: ${topicTitle}
Level: ${level}
Core formula: ${theorySummary}
Key points:
${points.map(p => p.replace(/<[^>]*>/g, '')).join('\n')}

Generate ${n} multiple choice questions.

Rules:
- Each question must test grammar accuracy
- Provide 4 options
- Exactly 1 correct answer
- Return ONLY JSON format:

{
 "quiz":[
   {"question":"...", "options":["A","B","C","D"], "correct":0}
 ]
}
`;

    // ===== CALL OPENAI =====
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You generate IELTS grammar quizzes." },
          { role: "user", content: prompt }
        ],
        temperature: 0.6
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: data });
    }

    const text = data.choices[0].message.content;

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = JSON.parse(text.replace(/```json|```/g,""));
    }

    return res.status(200).json(parsed);

  } catch (e) {
    return res.status(500).json({
      error: "Server error",
      detail: e.message
    });
  }
}
