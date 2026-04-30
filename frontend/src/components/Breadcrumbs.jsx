import React from 'react';
import { Link, useMatches } from 'react-router-dom';

// Each route can declare a `handle.crumb` — either a string or a function
// returning { label, group? } given the route's params/data.
export default function Breadcrumbs() {
  const matches = useMatches();
  const crumbs = matches
    .map((m) => {
      const c = m.handle?.crumb;
      if (!c) return null;
      const value = typeof c === 'function' ? c(m) : c;
      if (!value) return null;
      const obj = typeof value === 'string' ? { label: value } : value;
      return { ...obj, pathname: m.pathname };
    })
    .filter(Boolean);

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center text-body-sm flex-wrap">
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <React.Fragment key={c.pathname + i}>
            {i > 0 && <span className="mx-2 text-tertiary">/</span>}
            {c.group && i === 0 && (
              <>
                <span className="text-tertiary">{c.group}</span>
                <span className="mx-2 text-tertiary">/</span>
              </>
            )}
            {isLast ? (
              <span className="text-primary text-body truncate max-w-[60vw]">{c.label}</span>
            ) : (
              <Link to={c.pathname} className="text-secondary hover:text-primary transition-colors truncate max-w-[40vw]">
                {c.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
