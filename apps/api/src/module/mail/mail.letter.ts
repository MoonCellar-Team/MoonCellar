import { FRONT_URL } from "../../shared/constants";

export interface ILetterAction {
  label: string;
  url: string;
}

export interface ILetter {
  heading: string;
  paragraphs: string[];
  action?: ILetterAction;
  footnote?: string;
}

export interface IRenderedLetter {
  html: string;
  text: string;
}

export const TEST_LETTER_SUBJECT = "MoonCellar mail test";

const FONT =
  "ApercuPro, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const COLOR_BG = "#191d24";
const COLOR_PANEL = "#212731";
const COLOR_BORDER = "#2c3340";
const COLOR_ACCENT = "#6951ee";
const COLOR_TEXT = "#d9d9d9";
const COLOR_HEADING = "#ffffff";
const COLOR_MUTED = "#b0b2bc";

const LOGO = `${FRONT_URL}/images/logo-text.png`;
const LOGO_WIDTH = 181;
const LOGO_HEIGHT = 40;

const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => ENTITIES[character]);

const renderParagraph = (paragraph: string): string =>
  `<tr><td style="padding:16px 32px 0;font-family:${FONT};font-size:16px;line-height:26px;color:${COLOR_TEXT};">${escapeHtml(
    paragraph
  )}</td></tr>`;

const renderAction = (action: ILetterAction): string =>
  `<tr><td style="padding:28px 32px 0;"><a href="${escapeHtml(
    action.url
  )}" style="display:inline-block;padding:14px 28px;border-radius:10px;background:${COLOR_ACCENT};color:#ffffff;font-family:${FONT};font-size:16px;font-weight:700;text-decoration:none;">${escapeHtml(
    action.label
  )}</a></td></tr>`;

const renderFootnote = (footnote: string): string =>
  `<tr><td style="padding:16px 32px 0;font-family:${FONT};font-size:14px;line-height:22px;color:${COLOR_MUTED};">${escapeHtml(
    footnote
  )}</td></tr>`;

const renderHtml = (letter: ILetter): string =>
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(letter.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${COLOR_BG};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(
    letter.paragraphs[0] ?? letter.heading
  )}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR_BG};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${COLOR_PANEL};border-radius:16px;">
<tr><td style="padding:32px 32px 0;"><img src="${LOGO}" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" alt="MoonCellar" style="display:block;border:0;width:${LOGO_WIDTH}px;height:${LOGO_HEIGHT}px;"></td></tr>
<tr><td style="padding:28px 32px 0;font-family:${FONT};font-size:24px;line-height:32px;font-weight:700;color:${COLOR_HEADING};">${escapeHtml(
    letter.heading
  )}</td></tr>
${letter.paragraphs.map(renderParagraph).join("\n")}
${letter.action ? renderAction(letter.action) : ""}
${letter.footnote ? renderFootnote(letter.footnote) : ""}
<tr><td style="padding:32px;font-family:${FONT};font-size:13px;line-height:20px;color:${COLOR_MUTED};border-top:1px solid ${COLOR_BORDER};">MoonCellar &mdash; Game Tracker &amp; Database<br><a href="${FRONT_URL}" style="color:${COLOR_MUTED};">mooncellar.space</a></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

const renderText = (letter: ILetter): string =>
  [
    letter.heading,
    ...letter.paragraphs,
    letter.action ? `${letter.action.label}: ${letter.action.url}` : "",
    letter.footnote ?? "",
    "MoonCellar — Game Tracker & Database",
    FRONT_URL,
  ]
    .filter(Boolean)
    .join("\n\n");

export const renderLetter = (letter: ILetter): IRenderedLetter => ({
  html: renderHtml(letter),
  text: renderText(letter),
});

export const buildTestLetter = (): ILetter => ({
  heading: "Your mail is set up",
  paragraphs: [
    "This letter was sent by the MoonCellar API to confirm that its mail module reaches your inbox.",
    "Nothing else was sent and no account is attached to this message. If it arrived in the Inbox rather than the spam folder, SPF, DKIM and DMARC are all doing their job.",
  ],
  action: { label: "Open MoonCellar", url: FRONT_URL },
});
