const AI_CHAT_URL = "https://one.apprentice.cyou/api/v1/chat/completions";
const AI_API_KEY = "ok_LVcqtjxR6TplFpDXOgQBk7jhydGf4NaU";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function sendAiChat(systemPrompt: string, messages: ChatMessage[], userInput: string): Promise<string> {
  const res = await fetch(AI_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userInput },
      ],
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "Maaf, tidak dapat memproses. Coba lagi.";
}
