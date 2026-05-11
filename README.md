# haeahn_calendar

A lightweight Google Calendar-style room booking app for small teams. The app uses Next.js static export, React, TypeScript, FullCalendar, Tailwind CSS, Cloudflare Pages hosting, and Supabase Auth/PostgreSQL with Row Level Security.

## Free-Tier Fit

Verified on 2026-05-09 from official vendor documentation:

- Cloudflare Pages Free supports static site hosting with Git-based deployments, HTTPS, preview deployments, 500 builds/month, 1 concurrent build, 20-minute build timeout, 20,000 files/site, and 25 MiB maximum file size per asset.
- Vercel Hobby is free and includes CI/CD, previews, HTTPS, 100 GB/month Fast Data Transfer, 1M/month Edge Requests, 1M/month Function Invocations, 4 CPU-hours, 360 GB-hours provisioned memory, and 200 projects. Important caveat: Vercel states Hobby is for personal, non-commercial use only. For company/internal business usage, use Vercel Pro or another compliant host.
- Supabase Free includes 2 active projects, 50,000 monthly active users, 500 MB database, shared CPU and 500 MB RAM, 5 GB egress, 1 GB file storage, 200 realtime peak connections, 2M realtime messages, 500k Edge Function invocations, and inactivity pausing after 1 week.
- Supabase built-in Auth email sending is demo-grade and has a very low default limit of 2 emails/hour. This app uses email/password for normal sign-in and only sends email for signup confirmation and password reset.

Sources:

- [Vercel Hobby plan](https://vercel.com/docs/accounts/plans/hobby)
- [Vercel pricing](https://vercel.com/pricing/)
- [Vercel terms](https://vercel.com/legal/terms)
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare Pages static Next.js guide](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/)
- [Next.js static export](https://nextjs.org/docs/app/guides/static-exports)
- [Supabase pricing](https://supabase.com/pricing)
- [Supabase password Auth docs](https://supabase.com/docs/guides/auth/passwords)

## Architecture

- Frontend: Next.js App Router static export, React, TypeScript
- Calendar UI: FullCalendar React
- Backend/Auth/DB: Supabase hosted Auth and PostgreSQL
- Hosting: Cloudflare Pages
- Styling: Tailwind CSS
- Email notifications: placeholder Supabase Edge Function under `supabase/functions/send-reservation-notification`, disabled by default

There is no custom application backend in the booking flow. The browser uses the Supabase anon key, Supabase Auth sessions, RLS policies, and PostgreSQL constraints. Next.js is configured with `output: "export"`, so `npm run build` emits static files to `out/`.

## Local Development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Optional future notification integration. Disabled by default.
RESEND_API_KEY=
SEND_RESERVATION_EMAILS=false
```

Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are required for the app.

## Supabase Setup

1. Create a Supabase project.
2. Go to Authentication > Providers > Email.
3. Enable Email provider and Email/password signups.
4. Keep email confirmations enabled for signup verification.
5. Do not enable Magic Link or OTP as the normal login flow.
6. Set Site URL to your local URL while developing, for example `http://localhost:3000`.
7. Add deployed Cloudflare Pages URLs to Redirect URLs after deployment.
8. Open SQL Editor and run `supabase/schema.sql`.
9. Run `supabase/seed.sql` to add sample meeting rooms.
10. If older sample rooms already exist, run `supabase/single-room.sql` once to keep only `9층 회의실` active.

For production, configure a custom SMTP provider in Supabase Auth so signup verification and password reset emails are reliable.

## Shared Account

A shared room-booking account can be created in Supabase Auth, but it should be created through the Supabase Dashboard rather than seeded with SQL. Auth users are managed by Supabase Auth, not by the public application schema.

Recommended setup:

1. In Supabase Dashboard, go to Authentication > Users.
2. Add a new user with this email:
   ```text
   meeting@haeahn-calendar.local
   ```
3. Set a strong password and store it in your team password manager.
4. Mark the email as confirmed if the dashboard offers that option. If Supabase requires a real confirmation email, use a real shared mailbox instead.
5. Users can sign in from the app with:
   ```text
   ID: meeting
   ```

The app maps `meeting` to `meeting@haeahn-calendar.local` before calling Supabase Auth. Other users can still sign in with regular email/password accounts.

Alternative setup with a real mailbox:

1. Create a real shared mailbox, for example `calendar@your-company.com`.
2. In Supabase Dashboard, go to Authentication > Users.
3. Add a new user with the shared mailbox and a strong password.
4. Mark the email as confirmed if the dashboard offers that option, or complete the confirmation email from the mailbox.
5. Share the credentials only with the intended internal team.

Using a shared account means all reservations created by that login are owned by the same Supabase user. For per-person ownership and auditability, individual accounts are still preferred.

## Database Schema and RLS

The complete schema, constraints, triggers, grants, and RLS policies are in:

- `supabase/schema.sql`
- `supabase/seed.sql`

Core tables:

```sql
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  location text,
  capacity integer check (capacity is null or capacity > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete restrict,
  title text not null check (char_length(trim(title)) > 0),
  description text not null default '',
  start_time timestamptz not null,
  end_time timestamptz not null,
  organizer_user_id uuid not null references auth.users(id) on delete cascade,
  organizer_email text not null,
  attendees text[] not null default '{}',
  send_notification boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservations_valid_time check (end_time > start_time),
  constraint reservations_room_time_no_overlap exclude using gist (
    room_id with =,
    tstzrange(start_time, end_time, '[)') with &&
  )
);
```

RLS summary:

- Authenticated users can view active rooms.
- Authenticated users can view all reservations.
- Authenticated users can create only reservations where `organizer_user_id = auth.uid()` and `organizer_email` matches the JWT email.
- Users can update/delete only their own reservations.

Conflict prevention is enforced at the database level by the `reservations_room_time_no_overlap` PostgreSQL exclusion constraint. The UI translates that database error into a clear “room already booked” message.

## Cloudflare Pages Deployment

1. Push this repo to GitHub.
2. In Cloudflare Dashboard, go to Workers & Pages > Create application > Pages.
3. Connect the GitHub repository.
4. Use these build settings:
   - Framework preset: `Next.js (Static HTML Export)`
   - Build command: `npm run build`
   - Build output directory: `out`
5. Set environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Deploy.
7. In Supabase Auth URL Configuration, set:
   - Site URL: your production Cloudflare Pages URL, for example `https://haeahn-calendar.pages.dev`
   - Redirect URLs: your production URL and any preview URLs you want to allow

Because this app is exported as static files, Cloudflare only hosts the frontend. Supabase remains responsible for authentication, database access, authorization, and conflict prevention.

## Required Accounts

- Cloudflare: hosts the frontend on Cloudflare Pages.
- GitHub: stores the repository and triggers Cloudflare deployments.
- Supabase: provides Auth, PostgreSQL, RLS, and reservation data.
- Resend: optional later, only if reservation notification emails are enabled.

## Email Notifications

Reservation notification emails are intentionally disabled.

The modal shows the checkbox with “Feature temporarily disabled,” and saved reservations store `send_notification = false`.

Future implementation path:

1. Configure a transactional email provider such as Resend.
2. Set `RESEND_API_KEY`.
3. Set `SEND_RESERVATION_EMAILS=true`.
4. Deploy and call the Supabase Edge Function in `supabase/functions/send-reservation-notification`.
5. Add rate limiting and audit logging before enabling for general use.

Supabase Auth emails for signup verification and password reset still work through Supabase Auth.

## Setup Checklist

- [ ] Create Supabase project.
- [ ] Enable email/password Auth.
- [ ] Keep signup email confirmation enabled.
- [ ] Add local and deployed redirect URLs in Supabase Auth settings.
- [ ] Run `supabase/schema.sql`.
- [ ] Run `supabase/seed.sql`.
- [ ] Copy `.env.example` to `.env.local`.
- [ ] Set Supabase URL and anon key.
- [ ] Run `npm install`.
- [ ] Run `npm run dev`.
- [ ] Deploy to Cloudflare Pages.
- [ ] Add production environment variables.
- [ ] Configure custom SMTP before real production usage.

## Future Improvements

- Admin role for room CRUD and cross-user reservation management.
- Organization/domain allowlist for signups.
- Recurring reservations.
- Room filters by capacity, location, or equipment.
- Reservation email notifications with Resend or another provider.
- Supabase Realtime updates so multiple users see new bookings instantly.
- Calendar export or external Google Calendar sync.
