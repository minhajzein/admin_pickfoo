import TurndownService from "turndown";

let turndown: TurndownService | null = null;

function styleOf(node: Node): string {
  const el = node as Partial<Element>;
  return typeof el.getAttribute === "function" ? (el.getAttribute("style") ?? "").toLowerCase() : "";
}

/** Markdown emphasis must hug the text, so keep surrounding spaces outside the markers. */
function wrapInline(content: string, marker: string): string {
  const text = content.trim();
  if (!text) return content;
  const lead = /^\s/.test(content) ? " " : "";
  const trail = /\s$/.test(content) ? " " : "";
  return `${lead}${marker}${text}${marker}${trail}`;
}

const isBoldStyle = (style: string) => /font-weight:\s*(bold|[6-9]00)/.test(style);
const isItalicStyle = (style: string) => /font-style:\s*italic/.test(style);

function getTurndown(): TurndownService {
  if (turndown) return turndown;
  const td = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    emDelimiter: "*",
    strongDelimiter: "**",
    codeBlockStyle: "fenced",
  });
  td.remove(["style", "script", "meta", "title"]);

  // The post title is the page's H1, so pasted headings start at H2.
  td.addRule("headings", {
    filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
    replacement: (content, node) => {
      const level = Math.min(4, Math.max(2, Number(node.nodeName.charAt(1))));
      const text = content.replace(/\*\*/g, "").trim();
      return text ? `\n\n${"#".repeat(level)} ${text}\n\n` : "";
    },
  });

  const isBoldTag = (node: Node) => node.nodeName === "B" || node.nodeName === "STRONG";
  const isNormalWeight = (node: Node) =>
    /font-weight:\s*(normal|[1-4]00)/.test(styleOf(node));

  td.addRule("bold", {
    filter: (node) => isBoldTag(node) && !isNormalWeight(node),
    replacement: (content) => wrapInline(content, "**"),
  });
  // Google Docs wraps the whole clipboard in <b style="font-weight:normal">.
  td.addRule("notBold", {
    filter: (node) => isBoldTag(node) && isNormalWeight(node),
    replacement: (content) => content,
  });

  // Google Docs and Word mark formatting with inline styles on spans.
  td.addRule("styledSpan", {
    filter: (node) =>
      node.nodeName === "SPAN" && (isBoldStyle(styleOf(node)) || isItalicStyle(styleOf(node))),
    replacement: (content, node) => {
      const style = styleOf(node);
      const inHeading = !!(node as HTMLElement).closest?.("h1,h2,h3,h4,h5,h6");
      let out = content;
      if (isItalicStyle(style)) out = wrapInline(out, "*");
      if (isBoldStyle(style) && !inHeading) out = wrapInline(out, "**");
      return out;
    },
  });

  turndown = td;
  return td;
}

/** True when clipboard HTML carries formatting worth converting (not just plain text). */
export function hasRichFormatting(html: string): boolean {
  return /<(h[1-6]|p|li|ul|ol|strong|b|em|i|a|blockquote|img)\b/i.test(html);
}

export function htmlToMarkdown(html: string): string {
  return getTurndown()
    .turndown(html)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+$/gm, "")
    .replace(/^([ \t]*)([-*+]|\d+\.)[ \t]{2,}/gm, "$1$2 ")
    .replace(/^([ \t]*(?:[-*+]|\d+\.) [^\n]*)\n\n(?=[ \t]*(?:[-*+]|\d+\.) )/gm, "$1\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const FENCE = /^\s*(```|~~~)/;
const LIST_ITEM = /^\s*([-*+]|\d+[.)])\s/;
const TABLE_ROW = /^\s*\|/;
const QUOTE = /^\s*>/;

/** Mirrors the website: a single line break starts a new paragraph. */
export function normalizePostMarkdown(raw: string): string {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    out.push(line);
    if (FENCE.test(line)) inFence = !inFence;
    if (inFence) continue;

    const next = lines[i + 1];
    if (next === undefined || !line.trim() || !next.trim()) continue;

    const sameBlock =
      (LIST_ITEM.test(line) || /^\s{2,}\S/.test(line)) &&
      (LIST_ITEM.test(next) || /^\s{2,}\S/.test(next));
    const tableRows = TABLE_ROW.test(line) && TABLE_ROW.test(next);
    const quoteLines = QUOTE.test(line) && QUOTE.test(next);
    const setextUnderline = /^\s*=+\s*$/.test(next);
    if (!sameBlock && !tableRows && !quoteLines && !setextUnderline && !FENCE.test(next)) {
      out.push("");
    }
  }

  return out.join("\n");
}
