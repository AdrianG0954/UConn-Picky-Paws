create extension if not exists "pg_cron" with schema "pg_catalog";

alter table "public"."dining_halls" enable row level security;

alter table "public"."dishes" enable row level security;


