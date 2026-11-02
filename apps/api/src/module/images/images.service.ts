import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import mongoose, { type Model } from "mongoose";
import {
  IMAGE_DATA_URL_PATTERN,
  IMAGE_ELEMENTS_MAX,
  IMAGE_MODELS,
  type IImageProvider,
  type IGenerateImageRequest,
  type IGenerateImageResponse,
  type IGeneratedImage,
  type ISaveGeneratedImageRequest,
  type ISuggestImageElementsRequest,
  type ISuggestImageElementsResponse,
} from "@mooncellar/schemas";
import { assertAiKey, generateJson } from "../../shared/ai";
import { S3_FOLDERS } from "../../shared/s3";
import { FileService } from "../user/services/file-upload.service";
import {
  GeneratedImage,
  type GeneratedImageDocument,
} from "./schemas/generated-image.schema";

const OPENAI_URL = "https://api.openai.com/v1";
const RECRAFT_URL = "https://external.api.recraft.ai/v1";
const TOKEN_ENV = {
  openai: "OPENAI_API_KEY",
  recraft: "RECRAFT_API_TOKEN",
} as const;
const RECRAFT_STYLELESS_MODELS: Record<string, string> = {
  recraftv4_1_flash: "recraftv4_1",
};

const GENERATION_TIMEOUT_MS = 180_000;

const ELEMENTS_INSTRUCTIONS = `You split a generated image into the separate visual elements it is built from, so that each element can be produced as its own asset.
Look at the image and the prompt it was generated from. Return between 2 and ${IMAGE_ELEMENTS_MAX} distinct elements that are useful on their own: for a logo that is typically the symbol, the wordmark and any secondary mark; for an illustration, the main subjects and props.
For every element give a short name of two to four words and a generation prompt. The prompt asks to reproduce exactly that element from the reference image, alone and centred, keeping its shapes, colours and style, and leaving out everything else. Do not describe a background: it is set separately. Write the names and prompts in English.`;

const ELEMENTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["elements"],
  properties: {
    elements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "prompt"],
        properties: {
          name: { type: "string" },
          prompt: { type: "string" },
        },
      },
    },
  },
};

type IProviderResponse = {
  data?: { b64_json?: string }[];
  error?: { message?: string } | string;
  message?: string;
};

const hexToRgb = (hex: string) =>
  [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));

const parseDataUrl = (dataUrl: string) => {
  const mimetype = dataUrl.match(IMAGE_DATA_URL_PATTERN)?.[0].slice(5, -8);

  if (!mimetype) throw new BadRequestException("Unsupported image");

  return {
    mimetype,
    buffer: Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"),
  };
};

@Injectable()
export class ImagesService {
  private readonly logger = new Logger(ImagesService.name);

  constructor(
    @InjectModel(GeneratedImage.name)
    private readonly Images: Model<GeneratedImageDocument>,
    private readonly fileService: FileService
  ) {}

  async generate({
    provider,
    model,
    prompt,
    referenceDataUrl,
    keyColor,
  }: IGenerateImageRequest): Promise<IGenerateImageResponse> {
    this.assertModel(provider, model);

    const token = this.getToken(provider);
    const fullPrompt = keyColor
      ? `${prompt}\n\nBackground: a perfectly flat, uniform ${keyColor} colour filling the whole canvas, with no gradient, texture, shadow, glow or outline. Do not use ${keyColor} or any similar colour anywhere in the element itself. The element has crisp edges.`
      : prompt;

    if (provider === "openai" && referenceDataUrl) {
      const { mimetype, buffer } = parseDataUrl(referenceDataUrl);
      const form = new FormData();

      form.append("model", model);
      form.append("prompt", fullPrompt);
      form.append("n", "1");
      form.append("background", keyColor ? "opaque" : "transparent");
      form.append("output_format", "webp");
      form.append(
        "image",
        new Blob([buffer], { type: mimetype }),
        `reference.${mimetype.split("/")[1]}`
      );

      return this.requestImage(provider, model, `${OPENAI_URL}/images/edits`, {
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
    }

    const body =
      provider === "openai"
        ? {
            model,
            prompt: fullPrompt,
            n: 1,
            output_format: "webp",
            output_compression: 85,
          }
        : {
            model: referenceDataUrl
              ? (RECRAFT_STYLELESS_MODELS[model] ?? model)
              : model,
            prompt: fullPrompt,
            n: 1,
            response_format: "b64_json",
            ...(keyColor && {
              controls: { background_color: { rgb: hexToRgb(keyColor) } },
            }),
            ...(referenceDataUrl && {
              style_reference_urls: [referenceDataUrl],
            }),
          };

    return this.requestImage(
      provider,
      model,
      `${provider === "openai" ? OPENAI_URL : RECRAFT_URL}/images/generations`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );
  }

  async suggestElements({
    prompt,
    dataUrl,
  }: ISuggestImageElementsRequest): Promise<ISuggestImageElementsResponse> {
    assertAiKey();

    const { text } = await generateJson({
      instructions: ELEMENTS_INSTRUCTIONS,
      input: prompt,
      image: dataUrl,
      name: "elements",
      schema: ELEMENTS_SCHEMA,
    });
    const { elements } = JSON.parse(text) as ISuggestImageElementsResponse;

    return { elements: elements.slice(0, IMAGE_ELEMENTS_MAX) };
  }

  private getToken(provider: IImageProvider) {
    const token = process.env[TOKEN_ENV[provider]];

    if (!token) {
      throw new ServiceUnavailableException(
        `${TOKEN_ENV[provider]} is not set`
      );
    }

    return token;
  }

  private async requestImage(
    provider: IImageProvider,
    model: string,
    url: string,
    init: { headers: Record<string, string>; body: BodyInit }
  ): Promise<IGenerateImageResponse> {
    const response = await fetch(url, {
      method: "POST",
      ...init,
      signal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
    }).catch((error: Error) => {
      this.logger.error(error, `${provider} image request failed`);
      throw new BadGatewayException(`${provider} is not reachable`);
    });

    const payload = (await response
      .json()
      .catch(() => ({}))) as IProviderResponse;
    const image = payload.data?.[0]?.b64_json;

    if (!response.ok || !image) {
      const message =
        (typeof payload.error === "string"
          ? payload.error
          : payload.error?.message) ??
        payload.message ??
        `HTTP ${response.status}`;

      this.logger.warn(`${provider} ${model} refused to generate: ${message}`);
      throw new BadGatewayException(`${provider}: ${message}`);
    }

    return { dataUrl: `data:image/webp;base64,${image}` };
  }

  async save(
    { provider, model, prompt, dataUrl }: ISaveGeneratedImageRequest,
    userId: mongoose.Types.ObjectId
  ): Promise<IGeneratedImage> {
    this.assertModel(provider, model);

    const { mimetype, buffer } = parseDataUrl(dataUrl);
    const _id = new mongoose.Types.ObjectId();
    const url = await this.fileService.uploadPublicImage(
      { buffer, mimetype } as Express.Multer.File,
      String(_id),
      S3_FOLDERS.generated
    );

    const image = await this.Images.create({
      _id,
      url,
      prompt,
      provider,
      model,
      createdBy: userId,
    });

    return this.toResponse(image);
  }

  async list(): Promise<IGeneratedImage[]> {
    const images = await this.Images.find().sort({ createdAt: -1 });

    return images.map((image) => this.toResponse(image));
  }

  async remove(id: string) {
    if (!mongoose.isValidObjectId(id)) {
      throw new BadRequestException(`Invalid image id: ${id}`);
    }

    const image = await this.Images.findById(id).lean();

    if (!image) throw new NotFoundException("Image not found");

    const key = this.fileService.getKeyFromUrl(S3_FOLDERS.generated, image.url);

    if (key) await this.fileService.deleteFile(key, S3_FOLDERS.generated);

    await this.Images.deleteOne({ _id: image._id });

    return { _id: id };
  }

  private assertModel(provider: keyof typeof IMAGE_MODELS, model: string) {
    if (!IMAGE_MODELS[provider].includes(model)) {
      throw new BadRequestException(`Unknown ${provider} model: ${model}`);
    }
  }

  private toResponse(image: GeneratedImageDocument): IGeneratedImage {
    return {
      _id: String(image._id),
      url: image.url,
      prompt: image.prompt,
      provider: image.provider,
      model: image.model,
      createdAt: image.createdAt.toISOString(),
    };
  }
}
