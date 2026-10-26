import { ANONYMOUS } from '../shared/avatar';
import type { ImportKind } from '../shared/source';
import { newId } from './ids';

export type Status = 'pending' | 'approved' | 'rejected';
export const STATUSES: readonly Status[] = ['pending', 'approved', 'rejected'];

export interface Space {
  id: string;
  slug: string;
  name: string;
  logoKey: string | null;
  accentColor: string;
  headline: string;
  prompt: string;
  thankYou: string;
  collectPhoto: boolean;
  isAccepting: boolean;
  showBranding: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SpaceSummary extends Space {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
  approvedRatingSum: number;
  approvedRated: number;
  newThisWeek: number;
}

export interface Testimonial {
  id: string;
  spaceId: string;
  status: Status;
  rating: number | null;
  body: string;
  authorName: string | null;
  authorRole: string | null;
  photoKey: string | null;
  featured: boolean;
  source: ImportKind | null;
  sourceUrl: string | null;
  externalId: string | null;
  createdAt: number;
  reviewedAt: number | null;
}

export interface TestimonialWithSpace extends Testimonial {
  spaceName: string;
  spaceSlug: string;
  spaceAccent: string;
  spaceLogoKey: string | null;
}

interface SpaceRow {
  id: string;
  slug: string;
  name: string;
  logo_key: string | null;
  accent_color: string;
  headline: string;
  prompt: string;
  thank_you: string;
  collect_photo: number;
  is_accepting: number;
  show_branding: number;
  created_at: number;
  updated_at: number;
}

interface TestimonialRow {
  id: string;
  space_id: string;
  status: Status;
  rating: number | null;
  body: string;
  author_name: string | null;
  author_role: string | null;
  photo_key: string | null;
  featured: number;
  source: ImportKind | null;
  source_url: string | null;
  external_id: string | null;
  created_at: number;
  reviewed_at: number | null;
}

const toSpace = (r: SpaceRow): Space => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  logoKey: r.logo_key,
  accentColor: r.accent_color,
  headline: r.headline,
  prompt: r.prompt,
  thankYou: r.thank_you,
  collectPhoto: r.collect_photo === 1,
  isAccepting: r.is_accepting === 1,
  showBranding: r.show_branding === 1,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toTestimonial = (r: TestimonialRow): Testimonial => ({
  id: r.id,
  spaceId: r.space_id,
  status: r.status,
  rating: r.rating,
  body: r.body,
  authorName: r.author_name,
  authorRole: r.author_role,
  photoKey: r.photo_key,
  featured: r.featured === 1,
  source: r.source,
  sourceUrl: r.source_url,
  externalId: r.external_id,
  createdAt: r.created_at,
  reviewedAt: r.reviewed_at,
});

export const displayName = (t: Pick<Testimonial, 'authorName'>) => t.authorName?.trim() || ANONYMOUS;

/** Copy shown on the public form, falling back to friendly defaults. */
export function spaceCopy(space: Pick<Space, 'name' | 'headline' | 'prompt' | 'thankYou'>) {
  return {
    headline: space.headline || `Share your experience with ${space.name}`,
    prompt:
      space.prompt ||
      `A few honest sentences are perfect — what you liked, what changed for you, and who you'd recommend ${space.name} to.`,
    thankYou: space.thankYou || 'Your words genuinely make our day. We read every one and will review yours shortly.',
  };
}

// ── Spaces ────────────────────────────────────────────────────────────────

export async function listSpaceSummaries(db: D1Database): Promise<SpaceSummary[]> {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const { results } = await db
    .prepare(
      `SELECT s.*,
         COALESCE(SUM(t.status = 'pending'), 0)  AS pending,
         COALESCE(SUM(t.status = 'approved'), 0) AS approved,
         COALESCE(SUM(t.status = 'rejected'), 0) AS rejected,
         COUNT(t.id) AS total,
         COALESCE(SUM(CASE WHEN t.status = 'approved' THEN t.rating ELSE 0 END), 0) AS approved_rating_sum,
         COALESCE(SUM(t.status = 'approved' AND t.rating IS NOT NULL), 0) AS approved_rated,
         COALESCE(SUM(t.created_at > ?1), 0) AS new_this_week
       FROM spaces s
       LEFT JOIN testimonials t ON t.space_id = s.id
       GROUP BY s.id
       ORDER BY s.created_at ASC`,
    )
    .bind(weekAgo)
    .all<
      SpaceRow & {
        pending: number;
        approved: number;
        rejected: number;
        total: number;
        approved_rating_sum: number;
        approved_rated: number;
        new_this_week: number;
      }
    >();
  return results.map((r) => ({
    ...toSpace(r),
    pending: r.pending,
    approved: r.approved,
    rejected: r.rejected,
    total: r.total,
    approvedRatingSum: r.approved_rating_sum,
    approvedRated: r.approved_rated,
    newThisWeek: r.new_this_week,
  }));
}

export async function getSpace(db: D1Database, id: string): Promise<Space | null> {
  const row = await db.prepare('SELECT * FROM spaces WHERE id = ?1').bind(id).first<SpaceRow>();
  return row ? toSpace(row) : null;
}

export async function getSpaceBySlug(db: D1Database, slug: string): Promise<Space | null> {
  const row = await db.prepare('SELECT * FROM spaces WHERE slug = ?1').bind(slug).first<SpaceRow>();
  return row ? toSpace(row) : null;
}

export async function slugTaken(db: D1Database, slug: string, exceptId?: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT id FROM spaces WHERE slug = ?1 AND id != ?2')
    .bind(slug, exceptId ?? '')
    .first();
  return row !== null;
}

export interface SpaceInput {
  slug: string;
  name: string;
  logoKey: string | null;
  accentColor: string;
  headline: string;
  prompt: string;
  thankYou: string;
  collectPhoto: boolean;
  isAccepting: boolean;
  showBranding: boolean;
}

export async function insertSpace(db: D1Database, id: string, input: SpaceInput): Promise<void> {
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO spaces (id, slug, name, logo_key, accent_color, headline, prompt, thank_you,
         collect_photo, is_accepting, show_branding, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)`,
    )
    .bind(
      id,
      input.slug,
      input.name,
      input.logoKey,
      input.accentColor,
      input.headline,
      input.prompt,
      input.thankYou,
      input.collectPhoto ? 1 : 0,
      input.isAccepting ? 1 : 0,
      input.showBranding ? 1 : 0,
      now,
    )
    .run();
}

export async function updateSpace(db: D1Database, id: string, input: SpaceInput): Promise<void> {
  await db
    .prepare(
      `UPDATE spaces SET slug = ?2, name = ?3, logo_key = ?4, accent_color = ?5, headline = ?6,
         prompt = ?7, thank_you = ?8, collect_photo = ?9, is_accepting = ?10, show_branding = ?11,
         updated_at = ?12
       WHERE id = ?1`,
    )
    .bind(
      id,
      input.slug,
      input.name,
      input.logoKey,
      input.accentColor,
      input.headline,
      input.prompt,
      input.thankYou,
      input.collectPhoto ? 1 : 0,
      input.isAccepting ? 1 : 0,
      input.showBranding ? 1 : 0,
      Date.now(),
    )
    .run();
}

/** Deletes a space and its testimonials. Returns R2 keys that should be removed. */
export async function deleteSpace(db: D1Database, id: string): Promise<string[]> {
  const space = await getSpace(db, id);
  if (!space) return [];
  const { results } = await db
    .prepare('SELECT photo_key FROM testimonials WHERE space_id = ?1 AND photo_key IS NOT NULL')
    .bind(id)
    .all<{ photo_key: string }>();
  await db.batch([
    db.prepare('DELETE FROM testimonials WHERE space_id = ?1').bind(id),
    db.prepare('DELETE FROM import_sources WHERE space_id = ?1').bind(id),
    db.prepare('DELETE FROM import_skips WHERE space_id = ?1').bind(id),
    db.prepare('DELETE FROM spaces WHERE id = ?1').bind(id),
  ]);
  return [space.logoKey, ...results.map((r) => r.photo_key)].filter((k): k is string => Boolean(k));
}

// ── Testimonials ──────────────────────────────────────────────────────────

export const PAGE_SIZE = 25;

export async function listTestimonials(
  db: D1Database,
  spaceId: string,
  status: Status | 'all',
  page: number,
): Promise<{ items: Testimonial[]; hasMore: boolean }> {
  const offset = Math.max(0, page - 1) * PAGE_SIZE;
  const where = status === 'all' ? 'space_id = ?1' : 'space_id = ?1 AND status = ?2';
  const order = status === 'approved' ? 'featured DESC, created_at DESC' : 'created_at DESC';
  const stmt = db.prepare(
    `SELECT * FROM testimonials WHERE ${where} ORDER BY ${order} LIMIT ${PAGE_SIZE + 1} OFFSET ${offset}`,
  );
  const { results } = await (status === 'all' ? stmt.bind(spaceId) : stmt.bind(spaceId, status)).all<TestimonialRow>();
  return { items: results.slice(0, PAGE_SIZE).map(toTestimonial), hasMore: results.length > PAGE_SIZE };
}

export async function listApproved(
  db: D1Database,
  spaceId: string,
  limit: number,
): Promise<Testimonial[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM testimonials WHERE space_id = ?1 AND status = 'approved'
       ORDER BY featured DESC, created_at DESC LIMIT ?2`,
    )
    .bind(spaceId, limit)
    .all<TestimonialRow>();
  return results.map(toTestimonial);
}

/** `average` covers rated testimonials only; imported posts may have no stars. */
export async function approvedStats(
  db: D1Database,
  spaceId: string,
): Promise<{ count: number; rated: number; average: number }> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS count, COUNT(rating) AS rated, COALESCE(AVG(rating), 0) AS average
       FROM testimonials WHERE space_id = ?1 AND status = 'approved'`,
    )
    .bind(spaceId)
    .first<{ count: number; rated: number; average: number }>();
  return { count: row?.count ?? 0, rated: row?.rated ?? 0, average: Math.round((row?.average ?? 0) * 10) / 10 };
}

export async function recentPending(db: D1Database, limit: number): Promise<TestimonialWithSpace[]> {
  const { results } = await db
    .prepare(
      `SELECT t.*, s.name AS space_name, s.slug AS space_slug, s.accent_color AS space_accent,
              s.logo_key AS space_logo_key
       FROM testimonials t JOIN spaces s ON s.id = t.space_id
       WHERE t.status = 'pending'
       ORDER BY t.created_at DESC LIMIT ?1`,
    )
    .bind(limit)
    .all<TestimonialRow & { space_name: string; space_slug: string; space_accent: string; space_logo_key: string | null }>();
  return results.map((r) => ({
    ...toTestimonial(r),
    spaceName: r.space_name,
    spaceSlug: r.space_slug,
    spaceAccent: r.space_accent,
    spaceLogoKey: r.space_logo_key,
  }));
}

export async function getTestimonial(db: D1Database, id: string): Promise<Testimonial | null> {
  const row = await db.prepare('SELECT * FROM testimonials WHERE id = ?1').bind(id).first<TestimonialRow>();
  return row ? toTestimonial(row) : null;
}

export interface TestimonialInput {
  spaceId: string;
  rating: number;
  body: string;
  authorName: string | null;
  authorRole: string | null;
  photoKey: string | null;
}

export async function insertTestimonial(db: D1Database, id: string, input: TestimonialInput): Promise<void> {
  await db
    .prepare(
      `INSERT INTO testimonials (id, space_id, status, rating, body, author_name, author_role, photo_key, created_at)
       VALUES (?1, ?2, 'pending', ?3, ?4, ?5, ?6, ?7, ?8)`,
    )
    .bind(id, input.spaceId, input.rating, input.body, input.authorName, input.authorRole, input.photoKey, Date.now())
    .run();
}

export async function setStatus(db: D1Database, id: string, status: Status): Promise<void> {
  await db
    .prepare('UPDATE testimonials SET status = ?2, reviewed_at = ?3 WHERE id = ?1')
    .bind(id, status, status === 'pending' ? null : Date.now())
    .run();
}

export async function setFeatured(db: D1Database, id: string, featured: boolean): Promise<void> {
  await db.prepare('UPDATE testimonials SET featured = ?2 WHERE id = ?1').bind(id, featured ? 1 : 0).run();
}

/** Deletes a testimonial. Imported ones are remembered so a re-check doesn't restore them. */
export async function deleteTestimonial(db: D1Database, t: Testimonial): Promise<void> {
  const statements = [db.prepare('DELETE FROM testimonials WHERE id = ?1').bind(t.id)];
  if (t.externalId) {
    statements.push(
      db.prepare('INSERT OR IGNORE INTO import_skips (space_id, external_id) VALUES (?1, ?2)').bind(t.spaceId, t.externalId),
    );
  }
  await db.batch(statements);
}

// ── Imports ───────────────────────────────────────────────────────────────

export interface ImportedInput {
  body: string;
  name: string | null;
  role: string | null;
  rating: number | null;
  source: ImportKind | null;
  sourceUrl: string | null;
  externalId: string;
  createdAt: number;
}

/** Inserts imported testimonials, skipping duplicates and ones the founder deleted. Returns how many were added. */
export async function insertImported(
  db: D1Database,
  spaceId: string,
  items: ImportedInput[],
  status: Status,
): Promise<number> {
  if (items.length === 0) return 0;
  const now = Date.now();
  const results = await db.batch(
    items.map((t) =>
      db
        .prepare(
          `INSERT OR IGNORE INTO testimonials
             (id, space_id, status, rating, body, author_name, author_role, source, source_url, external_id, created_at, reviewed_at)
           SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12
           WHERE NOT EXISTS (SELECT 1 FROM import_skips WHERE space_id = ?2 AND external_id = ?10)`,
        )
        .bind(
          newId(),
          spaceId,
          status,
          t.rating,
          t.body,
          t.name,
          t.role,
          t.source,
          t.sourceUrl,
          t.externalId,
          t.createdAt,
          status === 'pending' ? null : now,
        ),
    ),
  );
  return results.reduce((n, r) => n + (r.meta.changes ?? 0), 0);
}

export interface ImportSource {
  id: string;
  spaceId: string;
  url: string;
  lastRunAt: number | null;
  lastStatus: string | null;
  lastAdded: number;
  createdAt: number;
}

interface ImportSourceRow {
  id: string;
  space_id: string;
  url: string;
  last_run_at: number | null;
  last_status: string | null;
  last_added: number;
  created_at: number;
}

const toSource = (r: ImportSourceRow): ImportSource => ({
  id: r.id,
  spaceId: r.space_id,
  url: r.url,
  lastRunAt: r.last_run_at,
  lastStatus: r.last_status,
  lastAdded: r.last_added,
  createdAt: r.created_at,
});

export async function listSources(db: D1Database, spaceId: string): Promise<ImportSource[]> {
  const { results } = await db
    .prepare('SELECT * FROM import_sources WHERE space_id = ?1 ORDER BY created_at ASC')
    .bind(spaceId)
    .all<ImportSourceRow>();
  return results.map(toSource);
}

export async function getSource(db: D1Database, id: string): Promise<ImportSource | null> {
  const row = await db.prepare('SELECT * FROM import_sources WHERE id = ?1').bind(id).first<ImportSourceRow>();
  return row ? toSource(row) : null;
}

export async function addSource(db: D1Database, spaceId: string, url: string): Promise<void> {
  await db
    .prepare('INSERT OR IGNORE INTO import_sources (id, space_id, url, created_at) VALUES (?1, ?2, ?3, ?4)')
    .bind(newId(), spaceId, url, Date.now())
    .run();
}

export async function deleteSource(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM import_sources WHERE id = ?1').bind(id).run();
}

/** Sources not checked since `before`, oldest first. */
export async function dueSources(db: D1Database, before: number, limit: number): Promise<ImportSource[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM import_sources WHERE last_run_at IS NULL OR last_run_at < ?1
       ORDER BY COALESCE(last_run_at, 0) ASC LIMIT ?2`,
    )
    .bind(before, limit)
    .all<ImportSourceRow>();
  return results.map(toSource);
}

export async function markSourceRun(db: D1Database, id: string, status: string, added: number): Promise<void> {
  await db
    .prepare('UPDATE import_sources SET last_run_at = ?2, last_status = ?3, last_added = ?4 WHERE id = ?1')
    .bind(id, Date.now(), status, added)
    .run();
}
