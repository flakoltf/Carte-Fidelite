import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { mfaStepUpRequired } from '@/lib/auth/mfa'

export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  const isProtected =
    path.startsWith('/dashboard') || path.startsWith('/scan') || path.startsWith('/admin')

  // Pas de session → routes protégées renvoyées au login.
  if (!user && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user) {
    // AAL : déterminer si un step-up MFA est requis.
    let needsStepUp = false
    let aalError = false
    try {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      needsStepUp = mfaStepUpRequired(aal?.currentLevel, aal?.nextLevel)
    } catch {
      aalError = true
    }

    // Fail-CLOSED (SEC-18) : si le niveau MFA est invérifiable (panne Auth), on ne laisse PAS
    // passer un utilisateur MFA non vérifié sur une route protégée → ré-authentification.
    // (Re-login rétablit le bon AAL ; aucun blocage en boucle pour les comptes sans MFA.)
    if (aalError) {
      if (isProtected) return NextResponse.redirect(new URL('/login', request.url))
      return response
    }

    if (needsStepUp) {
      // 2FA active mais code non saisi : seule /login/mfa est accessible.
      if (path !== '/login/mfa' && (isProtected || path === '/' || path === '/login' || path === '/signup')) {
        return NextResponse.redirect(new URL('/login/mfa', request.url))
      }
    } else if (path === '/' || path === '/login' || path === '/login/mfa' || path === '/signup') {
      // Session pleinement authentifiée : éloigner des pages d'entrée.
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  // /enroll/* (page publique d'enrôlement) et /api/enroll* sont exclus :
  // ce sont des routes publiques, sans session, identifiées par enrollment_token.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|enroll|api/enroll|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
