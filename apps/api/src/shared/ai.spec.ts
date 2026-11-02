import { ServiceUnavailableException } from "@nestjs/common";
import { assertAiKey, generateJson } from "./ai";
import { callOpenAi } from "./openai";

jest.mock("./openai", () => ({
  ...jest.requireActual("./openai"),
  callOpenAi: jest.fn(),
}));

describe("AI generation", () => {
  const originalEnv = process.env;
  const request = {
    instructions: "Identify the game.",
    input: "Game title",
    name: "game",
    schema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
      additionalProperties: false,
    },
  };

  beforeEach(() => {
    process.env = { ...originalEnv, OPENAI_API_KEY: "test" };
    delete process.env.OPENAI_MODEL;
    jest
      .mocked(callOpenAi)
      .mockReset()
      .mockResolvedValue({
        id: "response",
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: '{"name":"Game"}' }],
          },
        ],
      });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("rejects missing OpenAI credentials before making a request", async () => {
    delete process.env.OPENAI_API_KEY;

    expect(assertAiKey).toThrow(ServiceUnavailableException);
    await expect(generateJson(request)).rejects.toMatchObject({ status: 503 });
    expect(callOpenAi).not.toHaveBeenCalled();
  });

  it("requests strict JSON from OpenAI and returns the model used", async () => {
    await expect(generateJson(request)).resolves.toEqual({
      text: '{"name":"Game"}',
      model: "gpt-5-mini",
    });
    expect(callOpenAi).toHaveBeenCalledWith("test", {
      model: "gpt-5-mini",
      instructions: request.instructions,
      input: request.input,
      text: {
        format: {
          type: "json_schema",
          name: request.name,
          strict: true,
          schema: request.schema,
        },
      },
    });
  });

  it("includes the image for analysis and respects the configured model", async () => {
    process.env.OPENAI_MODEL = "configured-model";
    const image = "data:image/png;base64,aW1hZ2U=";

    await expect(generateJson({ ...request, image })).resolves.toMatchObject({
      model: "configured-model",
    });
    expect(callOpenAi).toHaveBeenCalledWith(
      "test",
      expect.objectContaining({
        model: "configured-model",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: request.input },
              { type: "input_image", image_url: image },
            ],
          },
        ],
      })
    );
  });

  it("propagates OpenAI errors without retrying", async () => {
    const error = new Error("OpenAI is unavailable");
    jest.mocked(callOpenAi).mockRejectedValue(error);

    await expect(generateJson(request)).rejects.toBe(error);
    expect(callOpenAi).toHaveBeenCalledTimes(1);
  });
});
