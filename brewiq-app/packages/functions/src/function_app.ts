import {
  UserDataFunctions,
  AudienceType,
  type RayfinContext,
} from '@microsoft/fabric-user-data-functions';
import { randomUUID } from 'node:crypto';
import { ANALYST_PROMPT } from './analyst-prompt.js';

const udf = new UserDataFunctions();

const FABRIC_API = 'https://api.fabric.microsoft.com/v1';
const WORKSPACE_ID = '5b675dd3-ccff-4509-af88-6fb38c1cfad1';
const LAKEHOUSE_ID = 'ab204818-5cf9-45ce-a649-ee68e2e56f45';
const NOTEBOOK_ID = '48b4636a-12ba-4eeb-95a4-5b527435aa97';
const ONELAKE = 'https://onelake.dfs.fabric.microsoft.com';
const MAX_URL_LENGTH = 2000;
const JOB_ID_PATTERN = /^[0-9a-f-]{36}$/;

type StartImportResult =
  | { ok: true; jobId: string }
  | { ok: false; message: string };

type ImportStatus =
  | { status: 'running' }
  | { status: 'error'; error: string }
  | { status: 'ok'; recipeJson: string };

udf.func(
  'startImport',
  async (
    ctx: RayfinContext<Record<string, never>, AudienceType.Fabric>,
    url: string,
  ): Promise<StartImportResult> => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { ok: false, message: 'Enter a valid URL.' };
    }
    if (parsed.protocol !== 'https:' || url.length > MAX_URL_LENGTH) {
      return { ok: false, message: 'Only https URLs are supported.' };
    }

    const jobId = randomUUID();
    const res = await fetch(
      `${FABRIC_API}/workspaces/${WORKSPACE_ID}/items/${NOTEBOOK_ID}/jobs/instances?jobType=RunNotebook`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ctx.Tokens.Fabric}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          executionData: {
            parameters: {
              url: { value: parsed.toString(), type: 'string' },
              job_id: { value: jobId, type: 'string' },
            },
          },
        }),
      },
    );
    if (!res.ok) {
      return {
        ok: false,
        message: `Could not start the import (Fabric returned ${res.status}).`,
      };
    }
    return { ok: true, jobId };
  },
  [],
);

type ProductImageResult =
  | { ok: true; imageUrl: string | null; pdfUrl: string | null }
  | { ok: false; message: string };

const PAGE_HOSTS = ['northernbrewer.com'];
const OG_IMAGE = [
  /<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]*content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["']/i,
];

udf.func(
  'readProductPage',
  async (pageUrl: string): Promise<ProductImageResult> => {
    let page: URL;
    try {
      page = new URL(pageUrl);
    } catch {
      return { ok: false, message: 'Enter a valid URL.' };
    }
    const host = page.hostname.toLowerCase();
    if (
      page.protocol !== 'https:' ||
      pageUrl.length > MAX_URL_LENGTH ||
      !PAGE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
    ) {
      return { ok: false, message: 'Only northernbrewer.com product pages are supported.' };
    }
    let html: string;
    try {
      const res = await fetch(page, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BrewIQ)', Accept: 'text/html' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        return { ok: false, message: `The page returned ${res.status}.` };
      }
      html = (await res.text()).slice(0, 4_000_000);
    } catch {
      return { ok: false, message: 'Could not load the page.' };
    }
    let imageUrl: string | null = null;
    for (const re of OG_IMAGE) {
      const raw = re.exec(html)?.[1];
      if (!raw) continue;
      try {
        const img = new URL(raw.replace(/&amp;/g, '&'), page);
        if (img.protocol === 'https:' && img.toString().length <= 600) {
          imageUrl = img.toString();
          break;
        }
      } catch {
        // try the next pattern
      }
    }

    if (!imageUrl && /\/products\/[^/]+$/.test(page.pathname)) {
      try {
        const res = await fetch(`${page.origin}${page.pathname}.js`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BrewIQ)' },
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok) {
          const featured = ((await res.json()) as { featured_image?: string }).featured_image;
          if (featured) {
            const img = new URL(featured, page);
            if (img.protocol === 'https:' && img.toString().length <= 600) {
              imageUrl = img.toString();
            }
          }
        }
      } catch {
        // the page itself may still give a PDF
      }
    }

    const pdfs: string[] = [];
    const flat = html.replace(/\\\//g, '/');
    for (const m of flat.matchAll(/(?:https?:)?\/\/[^"'\s<>()\\]+?\.pdf(?:\?[^"'\s<>()\\]*)?/gi)) {
      try {
        const link = new URL(m[0].replace(/&amp;/g, '&'), page);
        if (link.protocol === 'https:' && link.toString().length <= MAX_URL_LENGTH) {
          pdfs.push(link.toString());
        }
      } catch {
        // skip malformed links
      }
    }
    for (const m of flat.matchAll(/href=["']([^"']+?\.pdf(?:\?[^"']*)?)["']/gi)) {
      try {
        const link = new URL(m[1].replace(/&amp;/g, '&'), page);
        if (link.protocol === 'https:' && link.toString().length <= MAX_URL_LENGTH) {
          pdfs.push(link.toString());
        }
      } catch {
        // skip malformed links
      }
    }
    const pdfUrl = pdfs.find((p) => /instruction|recipe/i.test(p)) ?? pdfs[0] ?? null;

    if (!imageUrl && !pdfUrl) {
      return { ok: false, message: 'No product image or recipe PDF found on that page.' };
    }
    return { ok: true, imageUrl, pdfUrl };
  },
  [],
);

udf.func(
  'getImport',
  async (
    ctx: RayfinContext<Record<string, never>, AudienceType.Storage>,
    jobId: string,
  ): Promise<ImportStatus> => {
    if (!JOB_ID_PATTERN.test(jobId)) {
      return { status: 'error', error: 'Invalid job id.' };
    }
    const res = await fetch(
      `${ONELAKE}/${WORKSPACE_ID}/${LAKEHOUSE_ID}/Files/import/${jobId}.json`,
      { headers: { Authorization: `Bearer ${ctx.Tokens.Storage}` } },
    );
    if (res.status === 404) return { status: 'running' };
    if (!res.ok) {
      return { status: 'error', error: `Result read failed (${res.status}).` };
    }
    const body = (await res.json()) as {
      status?: string;
      recipe?: unknown;
      error?: string;
    };
    if (body.status === 'ok' && body.recipe) {
      return { status: 'ok', recipeJson: JSON.stringify(body.recipe) };
    }
    return {
      status: 'error',
      error: String(body.error ?? 'Import failed.').slice(0, 500),
    };
  },
  [],
);

const FOUNDRY_ENDPOINT = 'https://cgmbrewiq-foundry.cognitiveservices.azure.com';
const FOUNDRY_DEPLOYMENT = 'brewiq-analyst';
const FOUNDRY_API_VERSION = '2025-04-01-preview';
const MAX_BRIEF_LENGTH = 60_000;

type AnalysisFinding = {
  title: string;
  severity: 'info' | 'warning' | 'critical';
  evidence: string;
  recommendation: string;
};

type AnalyzeBatchResult =
  | {
      ok: true;
      health: 'good' | 'watch' | 'problem';
      summary: string;
      findings: AnalysisFinding[];
      nextCheck: string;
      model: string;
    }
  | { ok: false; message: string };

const SEVERITIES = ['info', 'warning', 'critical'];
const HEALTHS = ['good', 'watch', 'problem'];

udf.func(
  'analyzeBatch',
  async (
    ctx: RayfinContext<Record<string, never>, AudienceType.AzureAI>,
    briefJson: string,
  ): Promise<AnalyzeBatchResult> => {
    if (briefJson.length > MAX_BRIEF_LENGTH) {
      return { ok: false, message: 'The batch brief is too large.' };
    }
    try {
      JSON.parse(briefJson);
    } catch {
      return { ok: false, message: 'The batch brief is not valid JSON.' };
    }

    let res: Response;
    try {
      res = await fetch(
        `${FOUNDRY_ENDPOINT}/openai/deployments/${FOUNDRY_DEPLOYMENT}/chat/completions?api-version=${FOUNDRY_API_VERSION}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ctx.Tokens.AzureAI}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: ANALYST_PROMPT },
              { role: 'user', content: briefJson },
            ],
            response_format: { type: 'json_object' },
            max_completion_tokens: 4000,
          }),
          signal: AbortSignal.timeout(90_000),
        },
      );
    } catch {
      return { ok: false, message: 'The analyst did not respond in time.' };
    }
    if (!res.ok) {
      return { ok: false, message: `The analyst returned ${res.status}.` };
    }

    const body = (await res.json()) as {
      model?: string;
      choices?: { message?: { content?: string } }[];
    };
    let parsed: {
      health?: string;
      summary?: string;
      findings?: Partial<AnalysisFinding>[];
      next_check?: string;
    };
    try {
      parsed = JSON.parse(body.choices?.[0]?.message?.content ?? '');
    } catch {
      return { ok: false, message: 'The analyst returned an unreadable answer.' };
    }

    return {
      ok: true,
      health: HEALTHS.includes(parsed.health ?? '')
        ? (parsed.health as 'good' | 'watch' | 'problem')
        : 'watch',
      summary: String(parsed.summary ?? ''),
      findings: (parsed.findings ?? []).slice(0, 10).map((f) => ({
        title: String(f.title ?? ''),
        severity: SEVERITIES.includes(f.severity ?? '')
          ? (f.severity as AnalysisFinding['severity'])
          : 'info',
        evidence: String(f.evidence ?? ''),
        recommendation: String(f.recommendation ?? ''),
      })),
      nextCheck: String(parsed.next_check ?? ''),
      model: String(body.model ?? FOUNDRY_DEPLOYMENT),
    };
  },
  [],
);
