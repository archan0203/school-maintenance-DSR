-- School Maintenance: run this entire script in Supabase SQL Editor.
create extension if not exists pgcrypto;

create type public.app_role as enum ('admin','technician','staff');
create type public.repair_status as enum ('รอตรวจสอบ','รอดำเนินการ','กำลังดำเนินการ','เสร็จสิ้น','ยกเลิก');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'staff',
  created_at timestamptz not null default now()
);
create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  floor text,
  room text,
  created_at timestamptz not null default now()
);
create table public.repair_requests (
  id uuid primary key default gen_random_uuid(),
  request_no bigint generated always as identity unique,
  reporter_id uuid not null references public.profiles(id),
  title text not null,
  location_text text not null,
  description text not null,
  status public.repair_status not null default 'รอตรวจสอบ',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.repair_images (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.repair_requests(id) on delete cascade,
  storage_path text not null,
  kind text not null check(kind in ('before','after')),
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.repair_requests(id) on delete cascade,
  technician_id uuid not null references public.profiles(id),
  assigned_by uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now()
);
create table public.repair_updates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.repair_requests(id) on delete cascade,
  updated_by uuid not null references public.profiles(id),
  details text not null default '',
  material_quantity numeric(12,2) not null default 0,
  unit_price numeric(12,2) not null default 0,
  labor_cost numeric(12,2) not null default 0,
  total_cost numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid references public.repair_requests(id) on delete cascade,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  created_at timestamptz not null default now()
);

create or replace function public.current_role()
returns public.app_role language sql stable security definer set search_path=public
as $$ select role from public.profiles where id=auth.uid() $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
 insert into public.profiles(id,full_name,role)
 values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''), 'staff')
 on conflict(id) do nothing;
 return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.buildings enable row level security;
alter table public.locations enable row level security;
alter table public.repair_requests enable row level security;
alter table public.repair_images enable row level security;
alter table public.assignments enable row level security;
alter table public.repair_updates enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;

-- Profiles: users see their own profile; Admin can see/manage all.
create policy "profile self or admin read" on public.profiles for select to authenticated
using (id=auth.uid() or public.current_role()='admin');
create policy "admin update profiles" on public.profiles for update to authenticated
using (public.current_role()='admin') with check (public.current_role()='admin');

-- Building/location lists are visible to signed-in users; only Admin edits.
create policy "signed in read buildings" on public.buildings for select to authenticated using (true);
create policy "admin manage buildings" on public.buildings for all to authenticated
using (public.current_role()='admin') with check (public.current_role()='admin');
create policy "signed in read locations" on public.locations for select to authenticated using (true);
create policy "admin manage locations" on public.locations for all to authenticated
using (public.current_role()='admin') with check (public.current_role()='admin');

-- Staff can create requests and read only their own. Technicians/Admin read all.
create policy "create own request" on public.repair_requests for insert to authenticated
with check (reporter_id=auth.uid());
create policy "read requests by role" on public.repair_requests for select to authenticated
using (reporter_id=auth.uid() or public.current_role() in ('admin','technician'));
create policy "admin technician update requests" on public.repair_requests for update to authenticated
using (public.current_role() in ('admin','technician'))
with check (public.current_role() in ('admin','technician'));

create policy "read images permitted requests" on public.repair_images for select to authenticated
using (exists(select 1 from public.repair_requests r where r.id=request_id and
 (r.reporter_id=auth.uid() or public.current_role() in ('admin','technician'))));
create policy "upload image to own request or admin tech" on public.repair_images for insert to authenticated
with check (uploaded_by=auth.uid() and exists(select 1 from public.repair_requests r where r.id=request_id and
 (r.reporter_id=auth.uid() or public.current_role() in ('admin','technician'))));

-- Only Admin assigns; Admin/technician can read all assignments.
create policy "admin and technician read assignments" on public.assignments for select to authenticated
using (public.current_role() in ('admin','technician'));
create policy "admin assigns" on public.assignments for insert to authenticated
with check (public.current_role()='admin' and assigned_by=auth.uid() and
 exists(select 1 from public.profiles p where p.id=technician_id and p.role='technician'));
create policy "admin updates assignments" on public.assignments for update to authenticated
using (public.current_role()='admin') with check (public.current_role()='admin');
create policy "admin deletes assignments" on public.assignments for delete to authenticated
using (public.current_role()='admin');

-- Admin and technicians can record work. Staff can read updates for own requests.
create policy "read repair updates" on public.repair_updates for select to authenticated
using (exists(select 1 from public.repair_requests r where r.id=request_id and
 (r.reporter_id=auth.uid() or public.current_role() in ('admin','technician'))));
create policy "admin tech add updates" on public.repair_updates for insert to authenticated
with check (updated_by=auth.uid() and public.current_role() in ('admin','technician'));

create policy "read own notifications" on public.notifications for select to authenticated using(user_id=auth.uid());
create policy "update own notifications" on public.notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "admin read logs" on public.activity_logs for select to authenticated using(public.current_role()='admin');
create policy "signed in add logs" on public.activity_logs for insert to authenticated with check(user_id=auth.uid());

-- Private storage bucket. Upload paths should start with request UUID.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('repair-images','repair-images',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;

create policy "read repair image objects" on storage.objects for select to authenticated
using(bucket_id='repair-images' and exists(
 select 1 from public.repair_images i join public.repair_requests r on r.id=i.request_id
 where i.storage_path=name and (r.reporter_id=auth.uid() or public.current_role() in ('admin','technician'))
));
create policy "upload repair image objects" on storage.objects for insert to authenticated
with check(bucket_id='repair-images' and (storage.foldername(name))[1] is not null and exists(
 select 1 from public.repair_requests r where r.id::text=(storage.foldername(name))[1]
 and (r.reporter_id=auth.uid() or public.current_role() in ('admin','technician'))
));
