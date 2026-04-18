# General Setup

```
# 1. Start local supabase stack (applies migrations and seeds)
npm run supabase:start

# 1a. Login, link to remote (Should only have to do this once)
npm run supabase:login
npm run supabase:link # select picky-paws

# 2. Pull changes from remote
npm run supabase:pull

# 3. Serve edge functions locally
npm run supabase:functions:serve
```

# DB Changes Workflow

```
# 1. After modifying schema (I like doing it via studio), generate a migration
npm run supabase:migration:generate <filename>

# 2. Apply migrations to local db, then test
npm run supabase:migration:apply

# 3. Looks good, then push to remote (make sure you're logged in and project is linked)
npm run supabase:push
```

# Serverless functions workflow

- CAS auth functions require local function secrets. Rename `supabase/functions/.env.example` to `supabase/functions/.env` and populate values with your key using `npx supabase gen signing-key --algorithm ES256`. Wrap it in a string on one line.
- Populate `supabase/signing_keys.json` with the output and wrap in an array.

```
# After testing changes locally, deploy
npm run supabase:functions:deploy
```

# Other helpful commands

```
# See helpful urls and keys
npm run supabase:status

# Reset database to initial state (applies migrations and seeds)
npm run supabase:reset

# Stop supabase stack
npm run supabase:stop
```

# Debugging

- Try resetting your instance if migrations aren't applied
