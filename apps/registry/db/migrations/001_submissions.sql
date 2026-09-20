-- Private intake queue for visitor reports.
-- This table is NOT the public registry. Public records live in
-- apps/registry/data/registry.json and are only added through reviewed PRs.
-- Never store raw HTML, attachments, secrets, IP addresses or scan output here.

create table if not exists submissions (
  id uuid primary key,
  url text not null,
  note text not null default '',
  status text not null default 'pending_review'
    check (status in ('pending_review', 'accepted', 'rejected', 'duplicate')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer_note text
);

-- At most one pending report per normalized URL. A new report is allowed
-- once the previous one has been reviewed (accepted/rejected/duplicate).
create unique index if not exists submissions_one_pending_per_url
  on submissions (url) where status = 'pending_review';

create index if not exists submissions_status_submitted
  on submissions (status, submitted_at desc);
