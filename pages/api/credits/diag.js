import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req, res) {
  const db = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

  const specRes = await fetch(SUPA_URL + '/rest/v1/', {
    headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY }
  })
  const spec = await specRes.json()

  // RPCs aparecem em paths: /rpc/<nome>
  const out = { rpcs: {} }
  for (const [path, def] of Object.entries(spec.paths || {})) {
    if (path.startsWith('/rpc/')) {
      const name = path.replace('/rpc/', '')
      const post = def.post || {}
      const params = (post.parameters || []).map(p => ({
        name: p.name,
        type: p.schema?.type || (p.schema?.$ref ? p.schema.$ref : '?'),
      }))
      out.rpcs[name] = params
    }
  }

  return res.status(200).json(out)
}
