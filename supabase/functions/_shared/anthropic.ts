const anthropicUrl = "https://api.anthropic.com/v1/messages";

export async function callAnthropic(system: string, prompt: string) {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");

  const response = await fetch(anthropicUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6",
      max_tokens: 4096,
      temperature: 0.2,
      system,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic error ${response.status}: ${text}`);
  }

  const payload = await response.json();
  const text = payload.content?.find((part: { type: string }) => part.type === "text")?.text;
  if (!text) throw new Error("Anthropic returned no text content");

  return parseJsonOnly(text);
}

function parseJsonOnly(text: string) {
  const trimmed = text.trim();
  const withoutFence = trimmed.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(withoutFence);
  } catch {
    const firstBrace = withoutFence.indexOf("{");
    const lastBrace = withoutFence.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(withoutFence.slice(firstBrace, lastBrace + 1));
    }
    throw new Error("Anthropic returned text without valid JSON");
  }
}
