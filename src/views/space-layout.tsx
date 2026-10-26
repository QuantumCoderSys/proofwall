import type { Child } from 'hono/jsx';
import type { Space, SpaceSummary } from '../lib/db';
import { AppShell } from './app-shell';
import { CopyButton, SpaceLogo } from './components';
import { Icon } from './icons';

export type SpaceTab = 'testimonials' | 'share' | 'settings';

export interface SpaceLayoutProps {
  host: string;
  origin: string;
  spaces: SpaceSummary[];
  space: Space;
  tab: SpaceTab;
  toast?: string;
  children?: Child;
}

export const SpaceLayout = (props: SpaceLayoutProps) => {
  const { space } = props;
  const base = `/app/spaces/${space.id}`;
  const collectUrl = `${props.origin}/c/${space.slug}`;
  const pending = props.spaces.find((s) => s.id === space.id)?.pending ?? 0;
  const tabClass = (tab: SpaceTab) => (props.tab === tab ? 'tab is-active' : 'tab');

  return (
    <AppShell
      title={space.name}
      host={props.host}
      spaces={props.spaces}
      activeSpaceId={space.id}
      crumbs={[{ label: 'Spaces', href: '/app' }, { label: space.name }]}
      toast={props.toast}
      actions={
        <>
          <CopyButton value={collectUrl} label="Copy form link" class="btn-sm hide-mobile" />
          <a class="btn btn-secondary btn-sm" href={`/w/${space.slug}`} target="_blank" rel="noopener">
            <Icon name="heart" size={14} />
            <span class="hide-mobile">Wall of Love</span>
          </a>
        </>
      }
    >
      <div class="space-head">
        <SpaceLogo space={space} size={52} />
        <div class="space-head-main">
          <div class="space-title-row">
            <h1 class="page-title truncate">{space.name}</h1>
            {!space.isAccepting && <span class="pill pill-muted">Paused</span>}
          </div>
          <a class="space-link" href={collectUrl} target="_blank" rel="noopener">
            {collectUrl.replace(/^https?:\/\//, '')}
            <Icon name="external" size={12} />
          </a>
        </div>
      </div>

      <nav class="tabs" aria-label="Space sections" data-region="tabs">
        <a class={tabClass('testimonials')} href={base}>
          <Icon name="inbox" size={15} />
          Testimonials
          {pending > 0 && <span class="tab-count">{pending}</span>}
        </a>
        <a class={tabClass('share')} href={`${base}/share`}>
          <Icon name="code" size={15} />
          Share & embed
        </a>
        <a class={tabClass('settings')} href={`${base}/settings`}>
          <Icon name="sliders" size={15} />
          Settings
        </a>
      </nav>

      {props.children}
    </AppShell>
  );
};
