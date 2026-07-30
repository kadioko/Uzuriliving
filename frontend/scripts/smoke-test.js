const FRONTEND_URL = process.env.FRONTEND_SMOKE_URL || "https://www.uzuriliving.com";

async function request(path = "/") {
  const response = await fetch(`${FRONTEND_URL}${path}`);
  const html = await response.text();
  return { response, html };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  console.log(`Running frontend smoke test against ${FRONTEND_URL}`);

  const home = await request("/");
  assert(home.response.ok, `Home page failed: ${home.response.status}`);
  assert(home.html.includes("Uzuri Living"), "Home page does not include the Uzuri Living heading");
  assert(home.html.includes("POS Tanzania"), "Home page does not include the public product metadata");
  console.log("âœ“ Home page shell passed");

  const manifest = await request("/manifest.json");
  assert(manifest.response.ok, `Manifest request failed: ${manifest.response.status}`);
  assert(manifest.html.includes("Uzuri Living"), "Manifest does not include the Uzuri Living app name");
  console.log("âœ“ Manifest passed");

  console.log("Frontend smoke test completed successfully.");
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
