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
const FOUNDRY_PROJECT_ENDPOINT = 'https://cgmbrewiq-foundry.services.ai.azure.com/api/projects/brewiq';
const FOUNDRY_AGENT = 'brewiq-analyst-agent';
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

function mapAnalysis(text: string, model: string): AnalyzeBatchResult {
  let parsed: {
    health?: string;
    summary?: string;
    findings?: Partial<AnalysisFinding>[];
    next_check?: string;
  };
  try {
    parsed = JSON.parse(text);
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
    model,
  };
}

const FOUNDRY_ADVISOR = 'brewiq-advisor-agent';
const MAX_ADVISOR_MESSAGE = 2_000;

type AdviseBrewResult = { ok: true; reply: string; responseId: string } | { ok: false; message: string };

// Conversational recipe advisor. The conversation state lives in Foundry; the client passes back the
// previous response id to continue a thread ('' starts a new one).
udf.func(
  'adviseBrew',
  async (
    ctx: RayfinContext<Record<string, never>, AudienceType.AzureAI>,
    message: string,
    previousResponseId: string,
  ): Promise<AdviseBrewResult> => {
    const text = message.trim();
    if (!text) return { ok: false, message: 'Say what you are looking for.' };
    if (text.length > MAX_ADVISOR_MESSAGE) return { ok: false, message: 'That message is too long.' };
    if (previousResponseId && !/^[\w-]{1,200}$/.test(previousResponseId)) {
      return { ok: false, message: 'The conversation reference is invalid.' };
    }
    const request = () =>
      fetch(`${FOUNDRY_PROJECT_ENDPOINT}/openai/v1/responses`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ctx.Tokens.AzureAI}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: text,
          agent_reference: { type: 'agent_reference', name: FOUNDRY_ADVISOR },
          ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
        }),
        signal: AbortSignal.timeout(60_000),
      });
    let res: Response;
    try {
      res = await request();
      if (res.status === 429 || res.status >= 500) res = await request();
    } catch {
      return { ok: false, message: 'The advisor did not respond in time.' };
    }
    if (res.status === 403) return { ok: false, message: 'You do not have access to the recipe advisor.' };
    if (res.status === 404) return { ok: false, message: 'The recipe advisor has not been set up yet.' };
    if (!res.ok) return { ok: false, message: `The advisor returned ${res.status}.` };
    const body = (await res.json()) as {
      id?: string;
      output?: { type?: string; content?: { text?: string }[] }[];
    };
    const reply = body.output
      ?.filter((o) => o.type === 'message')
      .flatMap((o) => o.content ?? [])
      .map((c) => c.text ?? '')
      .join('')
      .trim();
    if (!reply || !body.id) return { ok: false, message: 'The advisor returned an empty answer.' };
    return { ok: true, reply, responseId: body.id };
  },
  [],
);

// Calls the Foundry agent (instructions + file-search knowledge). Returns null when the agent is
// unavailable (not created, no permission, throttled) so the caller can fall back to the model.
async function callAgent(token: string, briefJson: string): Promise<AnalyzeBatchResult | null> {
  const request = () =>
    fetch(`${FOUNDRY_PROJECT_ENDPOINT}/openai/v1/responses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: `Analyze this batch brief. Reply with JSON only.\n${briefJson}`,
        agent_reference: { type: 'agent_reference', name: FOUNDRY_AGENT },
      }),
      signal: AbortSignal.timeout(60_000),
    });
  try {
    let res = await request();
    if (res.status === 429 || res.status >= 500) res = await request();
    if (!res.ok) return null;
    const body = (await res.json()) as {
      output?: { type?: string; content?: { text?: string }[] }[];
    };
    const text = body.output
      ?.filter((o) => o.type === 'message')
      .flatMap((o) => o.content ?? [])
      .map((c) => c.text ?? '')
      .join('');
    if (!text) return null;
    const result = mapAnalysis(text, FOUNDRY_AGENT);
    return result.ok ? result : null;
  } catch {
    return null;
  }
}

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

    const agent = await callAgent(ctx.Tokens.AzureAI, briefJson);
    if (agent) return agent;

    const request = () =>
      fetch(
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
    let res: Response;
    try {
      res = await request();
      // The service occasionally returns a transient 5xx or 429; one retry clears most of them.
      if (res.status === 429 || res.status >= 500) res = await request();
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
    return mapAnalysis(body.choices?.[0]?.message?.content ?? '', String(body.model ?? FOUNDRY_DEPLOYMENT));
  },
  [],
);
