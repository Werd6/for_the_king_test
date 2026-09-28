const FRIENDLY: [RegExp, string][] = [
  [
    /failed to fetch|network request failed|networkerror|load failed|fetch failed/i,
    "Can't reach the server. Check your connection and try again.",
  ],
  [/invalid login credentials/i, 'Incorrect email or password.'],
  [/email not confirmed/i, 'Please confirm your email first. Check your inbox for the link.'],
  [/user already registered/i, 'An account with this email already exists. Try signing in.'],
  [/rate limit|too many requests/i, 'Too many attempts. Please wait a minute and try again.'],
  [/jwt expired|invalid jwt|refresh token/i, 'Your session expired. Please sign in again.'],
  [
    /new password should be different/i,
    'Your new password must be different from your old one.',
  ],
];

/** Turns Supabase/network errors into messages suitable for users. */
export function friendlyError(e: unknown, fallback = 'Something went wrong. Please try again.') {
  const message =
    e && typeof e === 'object' && 'message' in e && typeof e.message === 'string'
      ? e.message
      : '';
  if (!message) return fallback;
  for (const [pattern, friendly] of FRIENDLY) {
    if (pattern.test(message)) return friendly;
  }
  return message;
}
