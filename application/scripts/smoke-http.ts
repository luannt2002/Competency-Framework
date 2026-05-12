/**
 * HTTP smoke — hits the local dev server and prints the status code.
 * Mirrors `curl -s -o /dev/null -w "%{http_code}" $URL` for sandboxes that
 * block curl.
 */
async function main() {
  const url = process.argv[2] ?? 'http://localhost:3000/w/devops-test';
  const res = await fetch(url, { redirect: 'manual' });
  console.log(`${res.status} ${url}`);
}

main().catch((err) => {
  console.error('[smoke-http] FAILED:', err.message ?? err);
  process.exit(1);
});
