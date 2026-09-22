import { NextResponse, type NextRequest } from "next/server";

// Первый заслон: без cookie сессии внутрь не пускаем и сразу уводим на вход.
// Настоящая проверка — в src/lib/auth.ts, она сверяет токен с базой; здесь
// только быстрый отсев, чтобы не рендерить страницы неизвестному гостю.
const SESSION_COOKIE = "tt_session";
const PUBLIC_PATHS = ["/login"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (item) => pathname === item || pathname.startsWith(`${item}/`),
  );
  if (isPublic) return NextResponse.next();

  if (request.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();

  const target = request.nextUrl.clone();
  target.pathname = "/login";
  target.search = "";
  if (pathname !== "/") target.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(target);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};
