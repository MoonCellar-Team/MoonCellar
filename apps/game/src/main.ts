import { NestFactory } from "@nestjs/core";
import { GAME_STORAGE_MAX_FILE_BYTES } from "@mooncellar/schemas";
import { type NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { cleanupOpenApiDoc } from "nestjs-zod";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { getCorsOrigins } from "./shared/cors";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.set("trust proxy", 1);
  app.useBodyParser("json", { limit: "512kb" });
  app.useBodyParser("raw", {
    type: "application/octet-stream",
    limit: GAME_STORAGE_MAX_FILE_BYTES,
  });
  app.enableCors({ origin: getCorsOrigins() });
  app.useLogger(app.get(Logger));

  const config = new DocumentBuilder()
    .setTitle("MoonCellar Game API")
    .setDescription("Online service for the MoonCellar game ports")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
  SwaggerModule.setup("api", app, document, {
    swaggerOptions: { docExpansion: "none" },
  });

  await app.listen(Number(process.env.PORT) || 3229);
}
bootstrap();
