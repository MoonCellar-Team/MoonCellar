import { ServiceUnavailableException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { buildTestLetter, escapeHtml, renderLetter } from "./mail.letter";
import { MailService } from "./mail.service";

const configOf = (values: Record<string, string>): ConfigService =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

describe("renderLetter", () => {
  it("escapes interpolated text", () => {
    const letter = renderLetter({
      heading: "<script>alert(1)</script>",
      paragraphs: ["Tom & Jerry's <b>game</b>"],
    });

    expect(letter.html).not.toContain("<script>");
    expect(letter.html).toContain("&lt;script&gt;");
    expect(letter.html).toContain("Tom &amp; Jerry&#39;s &lt;b&gt;game&lt;/b&gt;");
  });

  it("carries both an html and a text part", () => {
    const letter = renderLetter(buildTestLetter());

    expect(letter.html).toContain("<!doctype html>");
    expect(letter.html).toContain("/images/logo-text.png");
    expect(letter.text).toContain("Your mail is set up");
    expect(letter.text).not.toContain("<");
  });

  it("escapes markup as text in the plain part", () => {
    expect(escapeHtml("a<b")).toBe("a&lt;b");
  });
});

describe("MailService", () => {
  it("is disabled when SMTP_HOST is unset", async () => {
    const service = new MailService(configOf({}));

    expect(service.isEnabled).toBe(false);
    await expect(
      service.send({ to: "a@b.c", subject: "s", letter: buildTestLetter() })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
