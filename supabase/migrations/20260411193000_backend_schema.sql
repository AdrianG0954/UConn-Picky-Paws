create table "public"."dining_halls" (
    "id" uuid not null default gen_random_uuid(),
    "req_id" text not null,
    "name" text not null
);

alter table "public"."dining_halls"
    add constraint "dining_halls_pkey" primary key ("id");

alter table "public"."dining_halls"
    add constraint "dining_halls_req_id_key" unique ("req_id");

create unique index "ix_dining_halls_name"
    on "public"."dining_halls" using btree ("name");

create table "public"."dishes" (
    "dining_hall_id" uuid not null,
    "name" text not null,
    "nutrition_info" jsonb not null,
    "elo_rating" double precision not null default 1000.0
);

alter table "public"."dishes"
    add constraint "dishes_pkey" primary key ("dining_hall_id", "name");

alter table "public"."dishes"
    add constraint "dishes_dining_hall_id_fkey"
    foreign key ("dining_hall_id")
    references "public"."dining_halls"("id")
    on delete cascade;

create index "ix_dishes_elo_rating"
    on "public"."dishes" using btree ("elo_rating");

create index "ix_dishes_dining_hall_id_elo_rating"
    on "public"."dishes" using btree ("dining_hall_id", "elo_rating");
