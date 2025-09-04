// Direct OpenAI API integration for development
// Note: In production, this should be moved to server-side for security

const OPENAI_API_KEY = "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";

export async function callOpenAIDirect(messages) {
  try {
    console.log("📤 Calling OpenAI directly...");
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: messages,
        max_tokens: 1500,
        temperature: 0.8,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices[0]?.message?.content || "מצטער, לא הצלחתי לקבל תגובה";
    
    return { reply };
  } catch (error) {
    console.error("❌ OpenAI Direct Error:", error);
    throw error;
  }
}
