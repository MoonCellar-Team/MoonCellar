import { ServiceUnavailableException } from "@nestjs/common";
import { callOpenAi, openAiModel, outputText } from "./openai";

export const assertAiKey = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new ServiceUnavailableException(
      "AI features are unavailable. Configure the OpenAI API key on the server."
    );
  }
};

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
  const model = openAiModel();
  const response = await callOpenAi(process.env.OPENAI_API_KEY!, {
    model,
    instructions,
    input: image
      ? [
          {
            role: "user",
            content: [
              { type: "input_text", text: input },
              { type: "input_image", image_url: image },
            ],
          },
        ]
      : input,
    text: { format: { type: "json_schema", name, strict: true, schema } },
  });

  return { text: outputText(response.output), model };
};
