import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/auth.config';

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isAuthenticated = !!req.auth;
  const isAuthPage = nextUrl.pathname.startsWith('/login');

  if (isAuthPage) {
    if (isAuthenticated) {
      const adminRoles = ['admin', 'super_admin', 'company_admin'];
      if (adminRoles.includes(req.auth?.user?.role as string)) {
        return Response.redirect(new URL('/admin/dashboard', nextUrl));
      }
      return Response.redirect(new URL('/employee/dashboard', nextUrl));
    }
    return null;
  }

  if (!isAuthenticated) {
    return Response.redirect(new URL('/login', nextUrl));
  }

  // Multi-Company Validation
  const activeCompanyId = req.cookies.get('activeCompanyId')?.value;
  const user = req.auth?.user as any;

  // console.log('[Middleware] NextUrl:', nextUrl.pathname);
  // console.log('[Middleware] Authenticated:', isAuthenticated);
  // console.log('[Middleware] User:', JSON.stringify(user));
  // console.log('[Middleware] activeCompanyId:', activeCompanyId);

  if (user && activeCompanyId) {
    const hasAccess = user.role === 'super_admin' || user.role === 'admin' || (user.companyIds && user.companyIds.includes(activeCompanyId)) || user.companyId === activeCompanyId;
    console.log('[Middleware] hasAccess:', hasAccess);
    if (!hasAccess) {
      console.log('[Middleware] Invalid activeCompanyId cookie detected. Clearing it and redirecting to a safe route.');
      const safeUrl = (user.role === 'super_admin' || user.role === 'admin' || user.role === 'company_admin') ? '/admin/dashboard' : '/employee/dashboard';
      const response = NextResponse.redirect(new URL(safeUrl, nextUrl));
      response.cookies.delete('activeCompanyId');
      return response;
    }
  }

  // Role based protection
  const adminRoles = ['admin', 'super_admin', 'company_admin'];
  const isAdmin = adminRoles.includes(req.auth?.user?.role as string);
  if (nextUrl.pathname.startsWith('/admin') && !isAdmin) {
    return Response.redirect(new URL('/employee/dashboard', nextUrl));
  }

  // Prevent 'admin' role from accessing employees and payroll pages
  // if (user?.role === 'admin' && (nextUrl.pathname.startsWith('/admin/employees') || nextUrl.pathname.startsWith('/admin/payroll'))) {
  //   return Response.redirect(new URL('/unauthorized', nextUrl));
  // }

  if (user?.role === 'admin' && nextUrl.pathname.startsWith('/admin/payroll')) {
    return Response.redirect(new URL('/unauthorized', nextUrl));
  }


  if (nextUrl.pathname.startsWith('/employee') && isAdmin) {
    return Response.redirect(new URL('/admin/dashboard', nextUrl));
  }

  return null;
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp)$).*)'],
};
