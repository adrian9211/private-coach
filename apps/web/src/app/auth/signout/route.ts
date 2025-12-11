import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function POST() {
  const cookieStore = await cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore as any })

  // Best-effort server-side signout to clear auth cookie
  await supabase.auth.signOut()

  return NextResponse.json({ ok: true })
}


