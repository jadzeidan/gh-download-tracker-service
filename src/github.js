import { getRepoSlug } from "./config.js";

const API_VERSION = "2022-11-28";
const PER_PAGE = 100;

function buildHeaders(githubToken) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": API_VERSION,
    "User-Agent": "gh-download-tracker-service"
  };

  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  return headers;
}

export async function fetchAllReleases({ githubToken, owner, repo }) {
  const releases = [];
  let page = 1;

  while (true) {
    const url = new URL(`https://api.github.com/repos/${owner}/${repo}/releases`);
    url.searchParams.set("per_page", String(PER_PAGE));
    url.searchParams.set("page", String(page));

    const response = await fetch(url, {
      headers: buildHeaders(githubToken)
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(
        `GitHub releases fetch failed for ${getRepoSlug()} with ${response.status}: ${responseText}`
      );
    }

    const pageItems = await response.json();

    if (!Array.isArray(pageItems)) {
      throw new Error("GitHub releases response was not an array.");
    }

    releases.push(...pageItems);

    if (pageItems.length < PER_PAGE) {
      break;
    }

    page += 1;
  }

  return releases;
}
