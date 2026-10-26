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
  rating: number;
  body: string;
  name: string;
  role: string | null;
  photoUrl: string | null;
  featured: boolean;
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
  stats: { count: number; average: number };
}
