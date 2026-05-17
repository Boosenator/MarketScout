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
      system: `${options.system}\nReturn only valid JSON. Start your response with { and do not include any introduction, explanation, or markdown fences.`,
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

  return parseJsonResponse<T>(text);
}

function stripJsonFences(value: string): string {
  return value.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
}

function parseJsonResponse<T>(text: string): T {
  const stripped = stripJsonFences(text).trim();

  try {
    return JSON.parse(stripped) as T;
  } catch {
    const extracted = extractFirstJsonObject(stripped);

    if (extracted) {
      return JSON.parse(extracted) as T;
    }

    throw new Error(`Anthropic response did not contain valid JSON. Response starts with: ${stripped.slice(0, 180)}`);
  }
}

function extractFirstJsonObject(value: string): string | null {
  const start = value.indexOf("{");

  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < value.length; index += 1) {
    const char = value[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth += 1;
    }

    if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return value.slice(start, index + 1);
      }
    }
  }

  return null;
}
