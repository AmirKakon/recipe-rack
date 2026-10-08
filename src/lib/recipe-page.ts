import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;
const MAX_HTML_BYTES = 3_000_000;
const PAGE_TEXT_LIMIT = 60_000;
// An honest bot UA: impersonating Chrome without real browser headers trips bot protection on some sites.
const USER_AGENT = 'Mozilla/5.0 (compatible; RecipeRack/1.0; +https://studio--recipe-rack-ighp8.us-central1.hosted.app)';

export class RecipePageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecipePageError';
  }
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    if (lower.startsWith('::ffff:')) return isPrivateAddress(lower.slice('::ffff:'.length));
    return lower === '::1' || lower === '::' || /^f[cd]/.test(lower) || lower.startsWith('fe80');
  }
  const [a, b] = address.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

// The server fetches user-supplied links, so refuse anything that resolves to an internal
// address (cloud metadata, localhost, VPC) to avoid being used as a proxy into the network.
async function assertPublicHttpUrl(url: URL): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new RecipePageError('Only http(s) links are supported.');
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  let addresses: string[];
  try {
    addresses = isIP(hostname) ? [hostname] : (await lookup(hostname, { all: true })).map((r) => r.address);
  } catch {
    throw new RecipePageError(`Could not find the website "${hostname}". Please check the link.`);
  }
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new RecipePageError('That link points to a private network address and cannot be scanned.');
  }
}

async function readTextCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_HTML_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  await reader.cancel().catch(() => undefined);
  return new TextDecoder().decode(Buffer.concat(chunks));
}

async function fetchPublicHtml(startUrl: URL): Promise<string> {
  let url = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHttpUrl(url);
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: 'manual',
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch {
      throw new RecipePageError('Could not reach that website. Please check the link and try again.');
    }
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) {
      throw new RecipePageError(
        `The website didn't return the page (status ${response.status}). Some sites block automated access — try a photo or screenshot of the recipe instead.`
      );
    }
    return readTextCapped(response);
  }
  throw new RecipePageError('That link redirected too many times.');
}

function extractRecipeContent(html: string): string {
  // Most recipe sites embed a schema.org Recipe as JSON-LD, which is far more reliable than scraped page text.
  const recipeJsonLd = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1].trim())
    .filter((block) => block.includes('"Recipe"'));
  if (recipeJsonLd.length > 0) {
    return `Structured recipe data (schema.org JSON-LD):\n${recipeJsonLd.join('\n').slice(0, PAGE_TEXT_LIMIT)}`;
  }

  const text = html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) throw new RecipePageError('That page has no readable text.');
  return `Web page text:\n${text.slice(0, PAGE_TEXT_LIMIT)}`;
}

export async function fetchRecipePageContent(rawUrl: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new RecipePageError('Please enter a valid link.');
  }
  return extractRecipeContent(await fetchPublicHtml(url));
}
