
  create policy "public can read dining halls"
  on "public"."dining_halls"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Enable read access for all users"
  on "public"."dishes"
  as permissive
  for select
  to public
using (true);



  create policy "public can read dishes"
  on "public"."dishes"
  as permissive
  for select
  to anon, authenticated
using (true);



