import { BadGatewayException, Logger } from "@nestjs/common";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const logger = new Logger("DeepSeek");

export const THINKING_DISABLED = { type: "disabled" } as const;

export type IDeepSeekTextPart = { type: "text"; text: string };
export type IDeepSeekImagePart = {
  type: "image_url";
  image_url: { url: string };
};
export type IDeepSeekContentPart = IDeepSeekTextPart | IDeepSeekImagePart;

export type IDeepSeekToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type IDeepSeekMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | IDeepSeekContentPart[] }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: IDeepSeekToolCall[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

export type IDeepSeekResponse = {
  id: string;
  choices: {
    finish_reason: string;
    message: {
      content: string | null;
      reasoning_content?: string | null;
      tool_calls?: IDeepSeekToolCall[];
    };
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export const deepSeekModel = () =>
  process.env.DEEPSEEK_MODEL || "deepseek-flash";

export const deepSeekKey = () => process.env.DEEPSEEK_API_KEY;

export async function callDeepSeek(
  apiKey: string,
  body: Record<string, unknown>
): Promise<IDeepSeekResponse> {
  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...body, thinking: THINKING_DISABLED }),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error(`DeepSeek request failed: ${res.status} ${text}`);
    throw new BadGatewayException(`DeepSeek request failed: ${res.status}`);
  }

  return (await res.json()) as IDeepSeekResponse;
}

export const messageText = (response: IDeepSeekResponse) =>
  response.choices[0]?.message.content ?? "";

export const deepSeekToolCalls = (response: IDeepSeekResponse) =>
  response.choices[0]?.message.tool_calls ?? [];
