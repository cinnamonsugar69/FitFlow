# Staff access and deployment

This milestone supports one gym. Staff submit issues and see their own submissions;
managers see all issues and assign or change status. Assignment still uses the
existing General Manager / Assistant Manager labels. Separate gyms and individual
staff assignments are future milestones.

## 1. Prepare Supabase

The repository does not contain the original live database definition. First take
a database backup and use a staging copy to check the migration. In the SQL editor,
inspect the existing table:

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'Issues'
order by ordinal_position;

select policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public' and tablename = 'Issues';
```

The app expects the case-sensitive `public."Issues"` table with `id`,
`member_name`, `phone`, `category`, `priority`, `assigned_to`, `description`,
`status`, `created_at`, and `created_by`. Member/issue/author fields should be
text-compatible, `created_at` a timestamp, and `id` have an automatic default
(the test fixture uses UUIDs). If `id` uses a sequence, grant authenticated users
USAGE on that specific sequence so inserts work. Verify these before applying.

Run `supabase/migrations/202610070001_staff_identity.sql` once in the SQL editor.
It runs in a transaction, creates `staff_profiles`, adds `created_by_user_id`,
enables row-level security, and replaces ALL previous Issues policies and browser
grants. Existing issue data and author names stay intact. Historical issues with
no user id are visible to managers only. Do not rerun after success.

Browser users cannot edit roles, authors, timestamps, member details, or delete
issues. The database stamps the approved author name and user id. Only managers
may update status and assignment. Removing a profile revokes database access
immediately; refresh the app after role/name changes.

## 2. Create the first two accounts

In Supabase Authentication, enable Email/password login and disable public signups.
In Users, create a confirmed staff account and a confirmed manager account with
passwords using the dashboard's Create user flow. Deliver passwords privately.
This milestone uses operator-created accounts; invite-link acceptance is not
implemented. Staff can use Forgot your password on the sign-in screen to request
a recovery email, then set a new password at `/reset-password`.

Copy the two user UUIDs into these statements and choose real staff names:

```sql
-- Replace the UUID placeholders before running. Never put passwords in SQL.
insert into public.staff_profiles (id, display_name, role) values
  ('STAFF_USER_UUID', 'Staff Name', 'staff'),
  ('MANAGER_USER_UUID', 'Manager Name', 'manager');
```

An Auth account without a profile has no member/issue access. Profiles are added
only by a trusted operator, never from browser sign-up metadata.

## 3. Run and test locally

Use Node.js 22. Copy `.env.example` to `.env.local` and supply the project URL
and **publishable** key. Never put a secret/service-role key in a `NEXT_PUBLIC_`
variable. Keep `.env.local` out of Git.

```powershell
npm ci
npm run lint
npm test
npm run build
npm run dev
```

Permission tests apply the actual migration to local PostgreSQL through PGlite,
with Supabase Auth roles simulated. They do not verify your live schema or login.
Use two independent browser sessions (normal and private) with test member data:

1. Signed out: `/` and `/issues` show sign-in with no member information.
2. Staff: submit an issue, check the real author, refresh, and see the submission
   in Issues. Staff cannot assign, resolve, or see someone else's issue.
3. Manager: see the staff submission and historical issues, assign it, mark it
   In Progress, then resolve it. Refresh both sessions to confirm persistence.
4. Sign out and refresh. Member information should disappear. Check phone-width
   layout, including the top navigation and sign-out button.
5. An Auth user without a profile sees an access message. Remove a test profile
   and confirm database access stops. Browser profile/role writes must be denied.

## 4. Prepare a Vercel deployment

Import `cinnamonsugar69/FitFlow` into Vercel, choose Next.js and the repository
root. Build command: `npm run build`; use the default Next.js output directory.
Set Node.js 22 and add these variables for the intended environments:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Use a separate staging Supabase project for previews where possible. Public
variables are embedded at build time; rebuild after changing them. CI uses only
placeholder values. Deployments must use the real project values.

In Supabase Auth URL configuration, set the Site URL to the final HTTPS URL and
allow intended redirect URLs. Password sign-in here has no email redirect,
but recovery emails require an allowed redirect to the change-password screen:
`https://fit-flow-blue.vercel.app/reset-password` for the current production site,
and `http://localhost:3000/reset-password` for local testing. Replace the production
address if the domain changes. Keep the default recovery email template's
confirmation link so Supabase verifies the token before redirecting to the app.

Test recovery with a real test account: request one email, open its newest link,
save matching passwords of at least 12 characters, and sign in using the new
password. Also check mismatched passwords and an expired link. A dashboard
recovery email redirected to the site root is forwarded to the reset screen.
Signed-out visitors cannot update a password without a valid Auth session.
Supabase's default email service is limited to two emails per hour; configure
custom SMTP before wider rollout. Email delivery and recovery must be verified
against the deployed project, separately from automated database permission tests.

Apply the migration and provision profiles before switching app traffic. The old
anonymous demo app stops working when its open policies are replaced, so coordinate
that change with this release. Deploy a preview and repeat the two-account checklist
before promoting to production.

## Release and recovery

GitHub Actions runs lint, permission tests, and a production build on PRs and main.
Merge after preview verification. If the application needs rollback, use a
compatible authenticated version or a maintenance screen. Do not restore open
anonymous policies to make the previous demo work. Recover database changes from
backup through the trusted Supabase operator if necessary.

References: [Supabase passwords](https://supabase.com/docs/guides/auth/passwords),
[row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Auth configuration](https://supabase.com/docs/guides/auth/general-configuration),
[Vercel environment variables](https://vercel.com/docs/environment-variables).
