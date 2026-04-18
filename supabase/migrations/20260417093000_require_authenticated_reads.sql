drop policy if exists "public can read dining halls" on "public"."dining_halls";

drop policy if exists "Enable read access for all users" on "public"."dishes";

drop policy if exists "public can read dishes" on "public"."dishes";

create policy "authenticated can read dining halls"
on "public"."dining_halls"
as permissive
for select
to authenticated
using (true);

create policy "authenticated can read dishes"
on "public"."dishes"
as permissive
for select
to authenticated
using (true);
