import { ServiceUnavailableException } from "@nestjs/common";
import { assertAiKey, generateJson } from "./ai";
import { callDeepSeek } from "./deepseek";

jest.mock("./deepseek", () => ({
  ...jest.requireActual("./deepseek"),
  callDeepSeek: jest.fn(),
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
  const answer = (content: string) => ({
    id: "chatcmpl",
    choices: [{ finish_reason: "stop", message: { content } }],
  });

  beforeEach(() => {
    process.env = { ...originalEnv, DEEPSEEK_API_KEY: "test" };
    delete process.env.DEEPSEEK_MODEL;
    jest
      .mocked(callDeepSeek)
      .mockReset()
      .mockResolvedValue(answer('{"name":"Game"}'));
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("rejects missing DeepSeek credentials before making a request", async () => {
    delete process.env.DEEPSEEK_API_KEY;

    expect(assertAiKey).toThrow(ServiceUnavailableException);
    await expect(generateJson(request)).rejects.toMatchObject({ status: 503 });
    expect(callDeepSeek).not.toHaveBeenCalled();
  });

  it("asks for a JSON object and returns the model used", async () => {
    await expect(generateJson(request)).resolves.toEqual({
      text: '{"name":"Game"}',
      model: "deepseek-flash",
    });
    expect(callDeepSeek).toHaveBeenCalledWith(
      "test",
      expect.objectContaining({
        model: "deepseek-flash",
        messages: [
          expect.objectContaining({
            role: "system",
            content: expect.stringContaining('"game" JSON schema'),
          }),
          { role: "user", content: request.input },
        ],
        response_format: { type: "json_object" },
      })
    );
  });

  it("includes the image for analysis and respects the configured model", async () => {
    process.env.DEEPSEEK_MODEL = "configured-model";
    const image = "data:image/png;base64,aW1hZ2U=";

    await expect(generateJson({ ...request, image })).resolves.toMatchObject({
      model: "configured-model",
    });
    expect(callDeepSeek).toHaveBeenCalledWith(
      "test",
      expect.objectContaining({
        model: "configured-model",
        messages: [
          expect.objectContaining({ role: "system" }),
          {
            role: "user",
            content: [
              { type: "text", text: request.input },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
      })
    );
  });

  it("propagates DeepSeek errors without retrying", async () => {
    const error = new Error("DeepSeek is unavailable");
    jest.mocked(callDeepSeek).mockRejectedValue(error);

    await expect(generateJson(request)).rejects.toBe(error);
    expect(callDeepSeek).toHaveBeenCalledTimes(1);
  });

  it("answers 502 when the model returns no JSON", async () => {
    jest.mocked(callDeepSeek).mockResolvedValue(answer("   "));

    await expect(generateJson(request)).rejects.toMatchObject({ status: 502 });
  });

  it("answers 502 when the answer was cut off", async () => {
    jest.mocked(callDeepSeek).mockResolvedValue({
      id: "chatcmpl",
      choices: [{ finish_reason: "length", message: { content: '{"name":' } }],
    });

    await expect(generateJson(request)).rejects.toMatchObject({ status: 502 });
  });
});
