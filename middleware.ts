import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/login", "/api/auth", "/setup"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Laisser passer les routes publiques
  if (PUBLIC_ROUTES.some(r => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // 2. Vérifier la présence du cookie de session (Firebase Auth par défaut n'envoie pas de cookie auto-géré sans config)
  // Note: Pour une sécurité totale, il faudrait utiliser Firebase Admin SDK et des Session Cookies.
  // Ici, on vérifie un cookie "session" personnalisé ou on laisse passer si c'est géré par le client.
  // Pour l'instant, on implémente une redirection si le cookie 'auth-token' est absent.
  const token = request.cookies.get("auth-token")?.value;

  if (!token && pathname !== "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
