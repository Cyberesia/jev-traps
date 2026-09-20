export type HtmlElement = {
  tag: string;
  attrs: Record<string, string>;
  rawAttrs: string;
  inner: string;
  text: string;
  selector: string;
  full: string;
};

export function decodeBasicEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&");
}

export function stripTags(value: string): string {
  return decodeBasicEntities(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript\s*>/gi, " ")
      .replace(/<!--([\s\S]*?)-->/g, " ")
      .replace(/<[^>]+>/g, " "),
  ).replace(/\s+/g, " ").trim();
}

export function parseAttributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    const name = match[1]?.toLowerCase();
    if (!name) continue;
    attrs[name] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attrs;
}

function selectorFor(tag: string, attrs: Record<string, string>): string {
  if (attrs.id) return `#${attrs.id}`;
  if (attrs["data-testid"]) return `[data-testid="${attrs["data-testid"]}"]`;
  const cls = attrs.class?.split(/\s+/).filter(Boolean)[0];
  return `${tag}${cls ? `.${cls}` : ""}`;
}

export function extractElements(html: string): HtmlElement[] {
  const out: HtmlElement[] = [];
  const pair = /<([a-zA-Z][\w:-]*)\b([^>]*)>([\s\S]*?)<\/\1\s*>/g;
  let match: RegExpExecArray | null;
  while ((match = pair.exec(html))) {
    const tag = (match[1] ?? "").toLowerCase();
    const rawAttrs = match[2] ?? "";
    const inner = match[3] ?? "";
    const attrs = parseAttributes(rawAttrs);
    out.push({
      tag,
      attrs,
      rawAttrs,
      inner,
      text: stripTags(inner),
      selector: selectorFor(tag, attrs),
      full: match[0],
    });
  }
  return out;
}

export function extractOpeningTags(html: string): Array<{ tag: string; attrs: Record<string, string>; selector: string; full: string }> {
  const out: Array<{ tag: string; attrs: Record<string, string>; selector: string; full: string }> = [];
  const re = /<([a-zA-Z][\w:-]*)\b([^>]*)>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const tag = (match[1] ?? "").toLowerCase();
    const attrs = parseAttributes(match[2] ?? "");
    out.push({ tag, attrs, selector: selectorFor(tag, attrs), full: match[0] });
  }
  return out;
}
