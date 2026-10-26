// Shapes shared by the Worker (public API) and the browser embed widget.

export type Layout = 'wall' | 'carousel' | 'card';
export type Theme = 'light' | 'dark' | 'auto';

export interface PublicSpace {
  slug: string;
  name: string;
  accentColor: string;
  logoUrl: string | null;
  collectUrl: string;
  wallUrl: string;
  showBranding: boolean;
  poweredByUrl: string;
}

export interface PublicTestimonial {
  id: string;
  /** null for imported posts that never had a star rating. */
  rating: number | null;
  body: string;
  name: string;
  role: string | null;
  photoUrl: string | null;
  featured: boolean;
  /** Where an imported testimonial came from ('web', 'x', 'bluesky'); null for form submissions. */
  source: string | null;
  sourceUrl: string | null;
  createdAt: number;
}

/** Options accepted by `window.ProofWall.mount(el, options)` and the matching data-* attributes. */
export interface MountOptions {
  space: string;
  layout?: Layout;
  theme?: Theme;
  limit?: number;
  id?: string;
  autoplay?: boolean;
  font?: 'default' | 'inherit';
  /** Dashboard preview: bypasses caches and shows an empty state instead of nothing. */
  preview?: boolean;
}

export interface PublicPayload {
  space: PublicSpace;
  testimonials: PublicTestimonial[];
  /** `average` is over the `rated` testimonials only. */
  stats: { count: number; rated: number; average: number };
}
