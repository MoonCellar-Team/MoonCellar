import {
  BadGatewayException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  callDeepSeek,
  deepSeekKey,
  deepSeekModel,
  messageText,
} from "./deepseek";

const JSON_MAX_TOKENS = 16_384;

export const assertAiKey = () => {
  if (!deepSeekKey()) {
    throw new ServiceUnavailableException(
      "AI features are unavailable. Configure the DeepSeek API key on the server."
    );
  }
};

const jsonInstructions = (
  instructions: string,
  name: string,
  schema: Record<string, unknown>
) =>
  `${instructions}

Return one json object that matches the "${name}" JSON schema below, with no text beside it:
${JSON.stringify(schema)}`;

export const generateJson = async ({
  instructions,
  input,
  image,
  name,
  schema,
}: {
  instructions: string;
  input: string;
  image?: string;
  name: string;
  schema: Record<string, unknown>;
}): Promise<{ text: string; model: string }> => {
  assertAiKey();
  const model = deepSeekModel();
  const response = await callDeepSeek(deepSeekKey()!, {
    model,
    messages: [
      { role: "system", content: jsonInstructions(instructions, name, schema) },
      {
        role: "user",
        content: image
          ? [
              { type: "text", text: input },
              { type: "image_url", image_url: { url: image } },
            ]
          : input,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: JSON_MAX_TOKENS,
  });

  if (response.choices[0]?.finish_reason === "length") {
    throw new BadGatewayException(
      "DeepSeek ran out of output tokens before it finished the answer. Retry the request."
    );
  }

  const text = messageText(response).trim();

  if (!text) {
    throw new BadGatewayException(
      "DeepSeek returned an empty answer. Retry the request."
    );
  }

  return { text, model };
};
