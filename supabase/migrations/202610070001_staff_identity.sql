-- Apply to the existing single-gym demo after a database backup.
-- Replaces ALL existing Issues policies, including permissive demo policies.
begin;

create table public.staff_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 100),
  role text not null check (role in ('staff', 'manager'))
);
alter table public.staff_profiles enable row level security;
revoke all on public.staff_profiles from anon, authenticated;
grant select on public.staff_profiles to authenticated;
create policy staff_read_own_profile on public.staff_profiles
  for select to authenticated using (id = (select auth.uid()));
-- Profiles/roles are provisioned by a trusted operator in the SQL editor.
-- Neither sign-up metadata nor browser writes grant staff/manager access.

alter table public."Issues" add column created_by_user_id uuid references auth.users(id);
create index issues_created_by_user_id_idx on public."Issues" (created_by_user_id);
alter table public."Issues" enable row level security;

do $$
declare existing record;
begin
  for existing in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'Issues'
  loop
    execute format('drop policy %I on public."Issues"', existing.policyname);
  end loop;
end $$;

revoke all on public."Issues" from anon, authenticated;
-- Table-level REVOKE does not remove pre-existing column-level grants.
do $$
declare columns text;
begin
  select string_agg(quote_ident(attname), ', ') into columns
    from pg_attribute where attrelid = 'public."Issues"'::regclass
    and attnum > 0 and not attisdropped;
  execute format('revoke all (%s) on public."Issues" from anon, authenticated', columns);
end $$;
grant select, insert on public."Issues" to authenticated;
grant update (status, assigned_to) on public."Issues" to authenticated;

create policy staff_read_issues on public."Issues"
  for select to authenticated using (
    exists (select 1 from public.staff_profiles p
      where p.id = (select auth.uid())
      and (p.role = 'manager' or created_by_user_id = p.id))
  );
create policy staff_create_issues on public."Issues"
  for insert to authenticated with check (
    created_by_user_id = (select auth.uid()) and status = 'Open'
    and exists (select 1 from public.staff_profiles p
      where p.id = (select auth.uid())
      and (p.role = 'manager' or assigned_to = 'Unassigned'))
  );
create policy manager_update_issues on public."Issues"
  for update to authenticated
  using (exists (select 1 from public.staff_profiles p
    where p.id = (select auth.uid()) and p.role = 'manager'))
  with check (exists (select 1 from public.staff_profiles p
    where p.id = (select auth.uid()) and p.role = 'manager'));

-- Authoritative identity is stamped by the database. Historical demo rows
-- retain their text attribution and a null user id; managers can still see them.
create function public.stamp_issue_identity() returns trigger
language plpgsql set search_path = '' as $$
declare staff_name text;
begin
  select display_name into staff_name from public.staff_profiles where id = auth.uid();
  if staff_name is null then
    raise exception 'Approved staff access is required' using errcode = '42501';
  end if;
  new.created_by_user_id := auth.uid();
  new.created_by := staff_name;
  new.created_at := now();
  if new.status is distinct from 'Open'
    or new.priority is null or new.priority not in ('Normal', 'Urgent')
    or new.assigned_to is null or new.assigned_to not in ('Unassigned', 'General Manager', 'Assistant Manager')
    or coalesce(length(trim(new.member_name)), 0) = 0
    or coalesce(length(trim(new.phone)), 0) = 0
    or coalesce(length(trim(new.category)), 0) = 0
    or coalesce(length(trim(new.description)), 0) not between 1 and 2000 then
    raise exception 'Invalid issue submission' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.stamp_issue_identity() from public, anon, authenticated;
create trigger stamp_issue_identity before insert on public."Issues"
  for each row execute function public.stamp_issue_identity();

create function public.validate_issue_management() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is null or new.status not in ('Open', 'In Progress', 'Resolved')
    or new.assigned_to is null or new.assigned_to not in ('Unassigned', 'General Manager', 'Assistant Manager') then
    raise exception 'Invalid issue status or assignment' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.validate_issue_management() from public, anon, authenticated;
create trigger validate_issue_management before update of status, assigned_to on public."Issues"
  for each row execute function public.validate_issue_management();

commit;
