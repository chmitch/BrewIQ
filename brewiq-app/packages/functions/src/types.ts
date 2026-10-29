/**
 * Function schema types for RayfinClient.
 *
 * AUTO-GENERATED — do not edit manually.
 * Re-generated automatically when function source files change.
 *
 * If this file is not updating automatically, run:
 *   rayfin dev functions apply
 *
 * The schema is a closed object type: only the function names listed
 * below are accepted by RayfinClient.functions.<name>.invoke(...).
 * Adding, renaming, or changing the signature of a udf.func() call
 * regenerates this file and surfaces type errors at every consumer.
 *
 * IMPORTANT: This file must NOT import any Node.js packages — it is
 * resolved by the frontend app's TypeScript compiler.
 */

export type AppFunctionsSchema = {
  startImport: {
    input: { url: string };
    output: { ok: true; jobId: string } | { ok: false; message: string };
  };
  readProductPage: {
    input: { pageUrl: string };
    output: { ok: true; imageUrl: null | string; pdfUrl: null | string } | { ok: false; message: string };
  };
  analyzeBatch: {
    input: { briefJson: string };
    output:
      | {
          ok: true;
          health: 'good' | 'watch' | 'problem';
          summary: string;
          findings: { title: string; severity: 'info' | 'warning' | 'critical'; evidence: string; recommendation: string }[];
          nextCheck: string;
          model: string;
        }
      | { ok: false; message: string };
  };
  getImport: {
    input: { jobId: string };
    output: { status: 'running' } | { status: 'error'; error: string } | { status: 'ok'; recipeJson: string };
  };
};
