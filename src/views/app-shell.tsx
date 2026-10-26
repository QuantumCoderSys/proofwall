import type { Child } from 'hono/jsx';
import type { SpaceSummary } from '../lib/db';
import { SpaceLogo } from './components';
import { Document } from './document';
import { Icon, LogoMark } from './icons';

export interface Crumb {
  label: string;
  href?: string;
}

export interface AppShellProps {
  title: string;
  host: string;
  spaces: SpaceSummary[];
  activeSpaceId?: string;
  activeNav?: 'overview' | 'new-space';
  crumbs: Crumb[];
  actions?: Child;
  toast?: string;
  children?: Child;
}

export const AppShell = (props: AppShellProps) => (
  <Document title={`${props.title} · ProofWall`} noindex toast={props.toast} bodyClass="app-body">
    <div class="app">
      <aside class="sidebar" id="sidebar" aria-label="Main navigation">
        <a href="/app" class="brand">
          <LogoMark size={22} />
          <span>ProofWall</span>
        </a>

        <nav class="nav" data-region="nav">
          <a href="/app" class={props.activeNav === 'overview' ? 'nav-item is-active' : 'nav-item'}>
            <Icon name="grid" />
            Overview
          </a>

          <div class="nav-section">
            <span>Spaces</span>
            <a href="/app/spaces/new" class="nav-add" aria-label="New space" title="New space">
              <Icon name="plus" size={14} />
            </a>
          </div>

          {props.spaces.map((s) => (
            <a
              href={`/app/spaces/${s.id}`}
              class={props.activeSpaceId === s.id ? 'nav-item is-active' : 'nav-item'}
            >
              <SpaceLogo space={s} size={18} />
              <span class="truncate">{s.name}</span>
              {s.pending > 0 && (
                <span class="nav-badge" title={`${s.pending} waiting for review`}>
                  {s.pending}
                </span>
              )}
            </a>
          ))}

          <a
            href="/app/spaces/new"
            class={props.activeNav === 'new-space' ? 'nav-item nav-item-muted is-active' : 'nav-item nav-item-muted'}
          >
            <Icon name="plus" />
            New space
          </a>
        </nav>

        <div class="sidebar-foot">
          <span class="me-avatar" aria-hidden="true">
            <Icon name="user" size={14} />
          </span>
          <div class="me">
            <div class="me-name">Founder</div>
            <div class="me-sub truncate">{props.host}</div>
          </div>
          <form method="post" action="/logout">
            <button type="submit" class="btn btn-ghost btn-icon" title="Sign out" aria-label="Sign out">
              <Icon name="logout" />
            </button>
          </form>
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          <button type="button" class="btn btn-ghost btn-icon nav-toggle" data-nav-toggle aria-label="Open menu">
            <Icon name="menu" />
          </button>
          <nav class="crumbs" aria-label="Breadcrumb">
            {props.crumbs.map((crumb, i) => (
              <>
                {i > 0 && <Icon name="chevronRight" size={14} class="crumb-sep" />}
                {crumb.href && i < props.crumbs.length - 1 ? (
                  <a href={crumb.href}>{crumb.label}</a>
                ) : (
                  <span class={i === props.crumbs.length - 1 ? 'current truncate' : 'truncate'}>{crumb.label}</span>
                )}
              </>
            ))}
          </nav>
          {props.actions && <div class="topbar-actions">{props.actions}</div>}
        </header>
        <main class="page">{props.children}</main>
      </div>
    </div>
    <div class="scrim" data-nav-toggle />
  </Document>
);
