import type { Env } from '../env';
import { dueSources, insertImported, markSourceRun, type ImportSource } from './db';
import { extractFromUrl, ImportError } from './importer';

const DAY_ISH = 20 * 60 * 60 * 1000;
// Free-plan Workers get 50 subrequests per invocation; one fetch per source keeps us well inside it.
const SOURCES_PER_RUN = 15;

/** Re-checks one saved link. New testimonials always arrive as pending. */
export async function checkSource(env: Env, source: ImportSource): Promise<{ added: number; status: string }> {
  let added = 0;
  let status: string;
  try {
    const { candidates } = await extractFromUrl(source.url);
    added = await insertImported(env.DB, source.spaceId, candidates, 'pending');
    status = added > 0 ? `Added ${added} new` : 'Up to date';
  } catch (err) {
    status = err instanceof ImportError ? err.message : 'Check failed — will retry tomorrow';
    if (!(err instanceof ImportError)) console.error('import check failed', source.url, err);
  }
  await markSourceRun(env.DB, source.id, status, added);
  return { added, status };
}

/** Called by the daily cron trigger. */
export async function runDueImports(env: Env): Promise<void> {
  const due = await dueSources(env.DB, Date.now() - DAY_ISH, SOURCES_PER_RUN);
  for (const source of due) await checkSource(env, source);
}
