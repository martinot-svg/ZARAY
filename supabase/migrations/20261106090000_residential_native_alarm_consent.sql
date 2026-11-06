-- Explicit, tenant-scoped consent for locally scheduled phone alarms.
-- This does not grant browser JavaScript or Supabase Auth users native alarm permissions.
alter table public.residential_notification_preferences
 add column if not exists alarm_enabled boolean not null default false,
 add column if not exists alarm_hour smallint not null default 8,
 add column if not exists alarm_days integer[] not null default array[7,3,1,0];

alter table public.residential_notification_preferences
 drop constraint if exists residential_alarm_hour_check;
alter table public.residential_notification_preferences
 add constraint residential_alarm_hour_check check (alarm_hour between 0 and 23);

alter table public.residential_notification_preferences
 drop constraint if exists residential_alarm_days_check;
alter table public.residential_notification_preferences
 add constraint residential_alarm_days_check check (
   cardinality(alarm_days) between 1 and 4
   and alarm_days <@ array[0,1,3,7]::integer[]
   and array_position(alarm_days,null) is null
 );

comment on column public.residential_notification_preferences.alarm_enabled is
 'Resident approved phone alarm synchronization. Native OS permission must separately be granted in the installed companion app.';
comment on column public.residential_notification_preferences.alarm_hour is
 'Local reminder hour in Indian/Antananarivo (Madagascar), 0–23.';
comment on column public.residential_notification_preferences.alarm_days is
 'Reminder days before expiration, subset of 7,3,1,0.';
