-- ─── Enable UUID ─────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── App Users (linked to auth.users) ────────────────────────────────────────
create table app_users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text not null,
  role        text not null check (role in ('admin','planner','operator','warehouse','sales')),
  created_at  timestamptz default now()
);
alter table app_users enable row level security;
create policy "user can read own profile" on app_users for select using (auth.uid() = id);
create policy "admin full access" on app_users using (
  exists (select 1 from app_users where id = auth.uid() and role = 'admin')
);

-- ─── Customers ────────────────────────────────────────────────────────────────
create table customers (
  id          uuid primary key default uuid_generate_v4(),
  code        text unique not null,
  name        text not null,
  address     text,
  contact     text,
  created_at  timestamptz default now()
);
alter table customers enable row level security;
create policy "all authenticated" on customers for all using (auth.role() = 'authenticated');

-- ─── Products ─────────────────────────────────────────────────────────────────
create table products (
  id          uuid primary key default uuid_generate_v4(),
  item_code   text unique not null,
  part_name   text not null,
  type        text not null check (type in ('blow','print','blow_print')),
  width       numeric,
  thickness   numeric,
  unit        text not null default 'kg',
  created_at  timestamptz default now()
);
alter table products enable row level security;
create policy "all authenticated" on products for all using (auth.role() = 'authenticated');

-- ─── Sale Orders ──────────────────────────────────────────────────────────────
create table sale_orders (
  id            uuid primary key default uuid_generate_v4(),
  so_no         text unique not null,
  customer_id   uuid references customers(id),
  product_id    uuid references products(id),
  item_code     text not null,
  mat_code      text,
  po_no         text,
  ship_to       text,
  qty           numeric not null,
  unit          text not null default 'kg',
  delivery_date date,
  remark        text,
  status        text not null default 'draft'
                check (status in ('draft','approved','in_planning','in_production','completed','cancelled')),
  created_by    uuid references auth.users(id),
  created_at    timestamptz default now()
);
alter table sale_orders enable row level security;
create policy "all authenticated" on sale_orders for all using (auth.role() = 'authenticated');

-- ─── Planning Jobs ────────────────────────────────────────────────────────────
create table planning_jobs (
  id              uuid primary key default uuid_generate_v4(),
  sale_order_id   uuid references sale_orders(id),
  dept            text not null check (dept in ('extrusion','printing','grinding')),
  machine_no      text,
  route_after     text check (route_after in ('to_printing','to_warehouse','to_grinding')),
  status          text not null default 'queued'
                  check (status in ('queued','ongoing','pending_receipt','done')),
  lot_no          text,
  planned_qty     numeric not null,
  created_at      timestamptz default now()
);
alter table planning_jobs enable row level security;
create policy "all authenticated" on planning_jobs for all using (auth.role() = 'authenticated');

-- ─── Production Logs ──────────────────────────────────────────────────────────
create table production_logs (
  id                uuid primary key default uuid_generate_v4(),
  planning_job_id   uuid references planning_jobs(id),
  dept              text not null check (dept in ('extrusion','printing','grinding')),
  actual_qty        numeric,
  rolls_qty         numeric,
  good_rolls        numeric,
  good_qty          numeric,
  bad_rolls         numeric,
  bad_qty           numeric,
  waste_qty         numeric,
  started_at        timestamptz,
  finished_at       timestamptz,
  approved_by       uuid references auth.users(id),
  created_at        timestamptz default now()
);
alter table production_logs enable row level security;
create policy "all authenticated" on production_logs for all using (auth.role() = 'authenticated');

-- ─── Warehouse Stock ──────────────────────────────────────────────────────────
create table warehouse_stock (
  id                uuid primary key default uuid_generate_v4(),
  planning_job_id   uuid references planning_jobs(id),
  lot_no            text not null,
  product_id        uuid references products(id),
  qty               numeric not null,
  unit              text not null default 'kg',
  location          text,
  condition         text not null default 'good' check (condition in ('good','hold','rejected')),
  received_at       timestamptz default now(),
  received_by       uuid references auth.users(id)
);
alter table warehouse_stock enable row level security;
create policy "all authenticated" on warehouse_stock for all using (auth.role() = 'authenticated');

-- ─── Requisitions ─────────────────────────────────────────────────────────────
create table requisitions (
  id              uuid primary key default uuid_generate_v4(),
  sale_order_id   uuid references sale_orders(id),
  items           jsonb not null default '[]',
  status          text not null default 'pending'
                  check (status in ('pending','approved','dispatched','cancelled')),
  requested_by    uuid references auth.users(id),
  approved_by     uuid references auth.users(id),
  created_at      timestamptz default now()
);
alter table requisitions enable row level security;
create policy "all authenticated" on requisitions for all using (auth.role() = 'authenticated');

-- ─── Invoices ─────────────────────────────────────────────────────────────────
create table invoices (
  id                uuid primary key default uuid_generate_v4(),
  sale_order_id     uuid references sale_orders(id),
  requisition_id    uuid references requisitions(id),
  amount            numeric not null,
  tax               numeric not null default 0,
  total             numeric not null,
  status            text not null default 'draft'
                    check (status in ('draft','issued','paid','cancelled')),
  issued_at         timestamptz,
  paid_at           timestamptz,
  created_at        timestamptz default now()
);
alter table invoices enable row level security;
create policy "all authenticated" on invoices for all using (auth.role() = 'authenticated');
