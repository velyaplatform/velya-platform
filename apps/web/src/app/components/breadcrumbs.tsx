'use client';

import Link from 'next/link';
import { CATEGORY_LABELS, getModuleById, type ModuleDef } from '../../lib/module-manifest';

/**
 * Breadcrumbs derived from the module manifest.
 *
 * Pattern: Início › <CategoryLabel> › <Módulo> › <Registro opcional>
 *
 * Following NN/g 2024 guidance and GOV.UK Design System: breadcrumbs reflect
 * the SITE HIERARCHY, not the user's session history. They complement (not
 * replace) the global Navigation sidebar.
 *
 *   - Início is always a link to /
 *   - Category is non-clickable text (it's just a grouping concept)
 *   - Module name is a link to the module's list route (when not the current page)
 *   - Record id is the current page (no link, aria-current="page")
 *
 * The component is wrapped in a `<nav aria-label="Trilha de navegação">` so
 * screen readers announce it as the secondary nav landmark.
 */

export interface BreadcrumbCrumb {
  label: string;
  href?: string;
  /** When true, this is the current page (no link, aria-current set) */
  current?: boolean;
}

interface BreadcrumbsProps {
  /** Pre-built crumb list. If omitted, the component derives crumbs from `module` + `recordLabel`. */
  crumbs?: BreadcrumbCrumb[];
  /** Module the user is currently viewing. */
  module?: ModuleDef;
  /** Module id (alternative to passing the module object) */
  moduleId?: string;
  /** Optional record label (e.g. "Cardiologia" or "MRN-EXAMPLE") to append as the leaf */
  recordLabel?: string;
  /** Optional href for the leaf record (when there's something deeper than detail) */
  recordHref?: string;
  /** Hide the "Início" root crumb (rare — only when the page itself is the home) */
  hideHome?: boolean;
  className?: string;
}

export function Breadcrumbs({
  crumbs,
  module,
  moduleId,
  recordLabel,
  recordHref,
  hideHome,
  className,
}: BreadcrumbsProps) {
  const resolved =
    crumbs ?? buildFromModule({ module, moduleId, recordLabel, recordHref, hideHome });
  if (resolved.length === 0) return null;

  return (
    <nav
      aria-label="Trilha de navegação"
      className={`flex flex-wrap items-center gap-1 text-xs text-neutral-500 mb-3 ${className ?? ''}`}
    >
      <ol className="flex flex-wrap items-center gap-1">
        {resolved.map((crumb, idx) => {
          const isLast = idx === resolved.length - 1;
          return (
            <li key={`${crumb.label}-${idx}`} className="flex items-center gap-1">
              {idx > 0 && (
                <span aria-hidden="true" className="text-neutral-500 mx-0.5">
                  ›
                </span>
              )}
              {crumb.href && !crumb.current ? (
                <Link
                  href={crumb.href}
                  className="text-neutral-900 hover:text-neutral-700 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-neutral-200 rounded"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={isLast ? 'text-neutral-700 font-semibold' : 'text-neutral-500'}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function buildFromModule({
  module,
  moduleId,
  recordLabel,
  recordHref,
  hideHome,
}: {
  module?: ModuleDef;
  moduleId?: string;
  recordLabel?: string;
  recordHref?: string;
  hideHome?: boolean;
}): BreadcrumbCrumb[] {
  const mod = module ?? (moduleId ? getModuleById(moduleId) : undefined);
  const out: BreadcrumbCrumb[] = [];
  if (!hideHome) {
    out.push({ label: 'Início', href: '/' });
  }
  if (mod) {
    out.push({ label: CATEGORY_LABELS[mod.category] });
    out.push({
      label: mod.title,
      href: recordLabel ? mod.route : undefined,
      current: !recordLabel,
    });
    if (recordLabel) {
      out.push({ label: recordLabel, href: recordHref, current: true });
    }
  }
  return out;
}
