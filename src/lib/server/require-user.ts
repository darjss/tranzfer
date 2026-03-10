type RequireUserContext = {
  locals: App.Locals;
  redirect: (
    path: string,
    status?: 300 | 301 | 302 | 303 | 304 | 307 | 308,
  ) => Response;
  url: URL;
};

export function requireUser(context: RequireUserContext) {
  if (context.locals.user) {
    return context.locals.user;
  }

  const next = `${context.url.pathname}${context.url.search}`;
  return context.redirect(`/auth/sign-in?next=${encodeURIComponent(next)}`);
}
