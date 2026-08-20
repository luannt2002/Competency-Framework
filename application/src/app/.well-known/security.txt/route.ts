/**
 * /.well-known/security.txt (RFC 9116) — tells security researchers where to
 * report vulnerabilities found in this deployment.
 */
export const dynamic = 'force-static';

export function GET(): Response {
  const body = [
    'Contact: mailto:security@example.com',
    'Expires: 2027-01-01T00:00:00.000Z',
    'Preferred-Languages: vi, en',
    'Canonical: /.well-known/security.txt',
    'Policy: / responsible disclosure, please allow 90 days',
  ].join('\n');
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
