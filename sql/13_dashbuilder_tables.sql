/* ═══════════════════════════════════════════════════════════════════════
   13 — Dashboard / menu / dynamic-page builder storage.

   Everything the Customise screen creates is stored per company in these
   tables, so a menu, a KPI or a page built by one user is available to
   everyone on that company — which is the whole point of putting it in the
   database instead of localStorage.

   Naming follows the existing convention: sp_* functions do the work, the
   server calls them, nothing writes these tables from the client.

     dash_page      one page (the dashboard is page 1). Holds layout + style.
     dash_widget    one KPI / chart / table on a page, with its query spec.
     dash_menu_set  a named, shareable custom menu.
     dash_menu_item the tree inside a menu set (sections, links, forms, pages).
     dyn_page       a dynamic page: filters + source config or raw SQL.
   ═══════════════════════════════════════════════════════════════════════ */

/* ── pages ────────────────────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.dash_page (
  id          bigserial   PRIMARY KEY,
  slug        text        NOT NULL,
  title       text        NOT NULL,
  description text        NOT NULL DEFAULT '',
  kind        text        NOT NULL DEFAULT 'dashboard',   -- dashboard | page
  is_home     boolean     NOT NULL DEFAULT false,
  layout      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  style       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_by  text        NOT NULL DEFAULT 'ADMIN',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_dash_page_slug ON public.dash_page (lower(slug));

/* ── widgets ──────────────────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.dash_widget (
  id          bigserial   PRIMARY KEY,
  page_id     bigint      NOT NULL REFERENCES public.dash_page (id) ON DELETE CASCADE,
  name        text        NOT NULL,
  chart_type  text        NOT NULL DEFAULT 'kpi',
  layout      jsonb       NOT NULL DEFAULT '{}'::jsonb,   -- {x,y,w,h}
  query       jsonb       NOT NULL DEFAULT '{}'::jsonb,   -- see sp_dash_widget_run
  style       jsonb       NOT NULL DEFAULT '{}'::jsonb,   -- palette, colours, opts
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_dash_widget_page ON public.dash_widget (page_id, sort_order);

/* ── custom menus ─────────────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.dash_menu_set (
  id          bigserial   PRIMARY KEY,
  name        text        NOT NULL,
  description text        NOT NULL DEFAULT '',
  is_active   boolean     NOT NULL DEFAULT false,
  created_by  text        NOT NULL DEFAULT 'ADMIN',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
/* Only one set may be the global default at a time. */
CREATE UNIQUE INDEX IF NOT EXISTS ux_dash_menu_set_active
  ON public.dash_menu_set ((true)) WHERE is_active;

CREATE TABLE IF NOT EXISTS public.dash_menu_item (
  id          bigserial   PRIMARY KEY,
  set_id      bigint      NOT NULL REFERENCES public.dash_menu_set (id) ON DELETE CASCADE,
  parent_id   bigint      REFERENCES public.dash_menu_item (id) ON DELETE CASCADE,
  label       text        NOT NULL,
  icon        text        NOT NULL DEFAULT 'bi-folder',
  kind        text        NOT NULL DEFAULT 'link',   -- section | link | form | page
  target      text        NOT NULL DEFAULT '',
  open_new    boolean     NOT NULL DEFAULT true,
  color       text        NOT NULL DEFAULT '',
  sort_order  integer     NOT NULL DEFAULT 0,
  visible     boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_dash_menu_item_set ON public.dash_menu_item (set_id, parent_id, sort_order);

/* Which menu a given person sees. Falls back to the single active set when a
   user has not chosen one, so an empty table means "everyone sees the active
   menu" and the app behaves exactly as it did before this feature existed. */
CREATE TABLE IF NOT EXISTS public.dash_menu_user_choice (
  userid     text        NOT NULL PRIMARY KEY,
  set_id     bigint      NOT NULL REFERENCES public.dash_menu_set (id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

/* A set can be offered to users to pick from (is_available) while only one of
   them is the default for people who never chose (is_active). */
ALTER TABLE public.dash_menu_set
  ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true;

/* Who is pinned to a set. The sidebar resolver reads this before anything else,
   so a person (or a whole group) sees only the menu their manager chose for
   them, whatever the company default happens to be. subject_type:
     user  - one person,  subject_id = userid
     group - everyone in a group, subject_id = group name
     all   - everyone, subject_id = ''            */
CREATE TABLE IF NOT EXISTS public.dash_menu_assignment (
  id           bigserial   PRIMARY KEY,
  set_id       bigint      NOT NULL REFERENCES public.dash_menu_set (id) ON DELETE CASCADE,
  subject_type text        NOT NULL DEFAULT 'user',  -- user | group | all
  subject_id   text        NOT NULL DEFAULT '',
  created_by   text        NOT NULL DEFAULT 'ADMIN',
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_dash_menu_assignment
  ON public.dash_menu_assignment (set_id, subject_type, subject_id);
CREATE INDEX IF NOT EXISTS ix_dash_menu_assignment_subject
  ON public.dash_menu_assignment (subject_type, subject_id);

/* ── dynamic pages ────────────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS public.dyn_page (
  id          bigserial   PRIMARY KEY,
  slug        text        NOT NULL,
  title       text        NOT NULL,
  icon        text        NOT NULL DEFAULT 'bi-table',
  description text        NOT NULL DEFAULT '',
  mode        text        NOT NULL DEFAULT 'builder',   -- builder | sql
  config      jsonb       NOT NULL DEFAULT '{}'::jsonb,  -- filters/sources/groupBy/sql
  style       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_by  text        NOT NULL DEFAULT 'ADMIN',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_dyn_page_slug ON public.dyn_page (lower(slug));

/* A page can appear in the active custom menu and/or in dashboard links.
   Both reference the slug rather than a second copy of the page, so renaming
   a page updates the navigation in one place. */
CREATE TABLE IF NOT EXISTS public.dash_link (
  id          bigserial   PRIMARY KEY,
  section     text        NOT NULL DEFAULT 'General',
  label       text        NOT NULL,
  icon        text        NOT NULL DEFAULT 'bi-link-45deg',
  kind        text        NOT NULL DEFAULT 'page',   -- page | form | link
  target      text        NOT NULL DEFAULT '',
  open_new    boolean     NOT NULL DEFAULT true,
  color       text        NOT NULL DEFAULT '',
  sort_order  integer     NOT NULL DEFAULT 0,
  visible     boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_dash_link_section ON public.dash_link (section, sort_order);
