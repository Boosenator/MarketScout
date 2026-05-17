const anthropicVersion = "2023-06-01";

interface AnthropicTextBlock {
  type: "text";
  text: string;
}

interface AnthropicResponse {
  content: AnthropicTextBlock[];
  stop_reason?: string;
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
  rateLimitRetries?: number;
}

export async function completeJson<T>(options: CompleteJsonOptions): Promise<T> {
  const first = await requestAnthropic(options);
  const firstParse = tryParseJsonResponse<T>(first.text);

  if (firstParse.ok) {
    return firstParse.value;
  }

  if (first.stopReason === "max_tokens") {
    const retry = await requestAnthropic({
      ...options,
      maxTokens: Math.max(options.maxTokens ?? 2000, 8000)
    });
    const retryParse = tryParseJsonResponse<T>(retry.text);

    if (retryParse.ok) {
      return retryParse.value;
    }

    return repairJson<T>(options, retry.text);
  }

  return repairJson<T>(options, first.text);
}

async function requestAnthropic(options: CompleteJsonOptions): Promise<{ text: string; stopReason?: string }> {
  const attempts = (options.rateLimitRetries ?? 2) + 1;
  let lastRateLimitDetails = "";

  for (let attempt = 0; attempt < attempts; attempt += 1) {
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

    if (response.status === 429 && attempt < attempts - 1) {
      lastRateLimitDetails = await response.text();
      const retryAfterSeconds = Number(response.headers.get("retry-after"));
      const delayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : 65000;
      console.warn(`Anthropic rate limit hit. Waiting ${Math.round(delayMs / 1000)}s before retry ${attempt + 1}.`);
      await sleep(delayMs);
      continue;
    }

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

    return { text, stopReason: payload.stop_reason };
  }

  throw new Error(`Anthropic request failed: 429 ${lastRateLimitDetails}`);
}

async function repairJson<T>(options: CompleteJsonOptions, invalidJson: string): Promise<T> {
  const response = await requestAnthropic({
    apiKey: options.apiKey,
    model: options.model,
    system: "You repair malformed JSON. Return only one valid JSON object. Preserve the same schema and data as much as possible.",
    messages: [
      {
        role: "user",
        content: `Repair this malformed or truncated JSON into one valid JSON object. Do not add markdown or commentary.\n\n${invalidJson}`
      }
    ],
    maxTokens: Math.max(options.maxTokens ?? 2000, 8000)
  });
  const repaired = tryParseJsonResponse<T>(response.text);

  if (repaired.ok) {
    return repaired.value;
  }

  throw new Error(`Anthropic response did not contain valid JSON. Response starts with: ${invalidJson.slice(0, 180)}`);
}

function stripJsonFences(value: string): string {
  return value.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
}

type ParseResult<T> = { ok: true; value: T } | { ok: false };

function tryParseJsonResponse<T>(text: string): ParseResult<T> {
  const stripped = stripJsonFences(text).trim();

  try {
    return { ok: true, value: JSON.parse(stripped) as T };
  } catch {
    const extracted = extractFirstJsonObject(stripped);

    if (extracted) {
      try {
        return { ok: true, value: JSON.parse(extracted) as T };
      } catch {
        return { ok: false };
      }
    }

    return { ok: false };
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
