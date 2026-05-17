const anthropicVersion = "2023-06-01";

interface AnthropicTextBlock {
  type: "text";
  text: string;
}

interface AnthropicResponse {
  content: AnthropicTextBlock[];
}

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

interface AnthropicTool {
  type: string;
  name: string;
}

interface CompleteJsonOptions {
  apiKey: string;
  model: string;
  system: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
  tools?: AnthropicTool[];
}

export async function completeJson<T>(options: CompleteJsonOptions): Promise<T> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": options.apiKey,
      "anthropic-version": anthropicVersion
    },
    body: JSON.stringify({
      model: options.model,
      max_tokens: options.maxTokens ?? 2000,
      system: `${options.system}\nReturn only valid JSON. Do not wrap it in markdown.`,
      messages: options.messages,
      tools: options.tools
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Anthropic request failed: ${response.status} ${details}`);
  }

  const payload = (await response.json()) as AnthropicResponse;
  const text = payload.content
    .filter((block): block is AnthropicTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  return JSON.parse(stripJsonFences(text)) as T;
}

function stripJsonFences(value: string): string {
  return value.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
}
