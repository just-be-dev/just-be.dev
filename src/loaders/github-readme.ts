import type { LiveLoader } from "astro:content";
import {
  cacheApiStore,
  createReadmeFetcher,
  DEFAULT_REF,
  USER_AGENT,
} from "../utils/github-readme";

const DEFAULT_OWNER = "just-be-dev";

// One fetcher per isolate, so its in-memory cache is shared by requests.
let readmes: ReturnType<typeof createReadmeFetcher> | undefined;
function getReadmes() {
  readmes ??= createReadmeFetcher({ store: cacheApiStore() });
  return readmes;
}

interface ReadmeData {
  repo: string;
  url: string;
  branch: string;
  owner: string;
}

interface EntryFilter {
  owner?: string;
  repo: string;
}

interface CollectionFilter {
  owner?: string;
}

export function githubReadmeLoader(): LiveLoader<ReadmeData, EntryFilter, CollectionFilter, Error> {
  return {
    name: "github-readme",

    async loadCollection({ filter }) {
      const owner = filter?.owner || DEFAULT_OWNER;

      try {
        // Fetch list of repositories from GitHub API
        const reposResponse = await fetch(
          `https://api.github.com/users/${owner}/repos?per_page=100&type=public`,
          { headers: { "User-Agent": USER_AGENT } },
        );

        if (!reposResponse.ok) {
          return {
            entries: [],
            error: new Error(`Failed to fetch repos for ${owner}: ${reposResponse.status}`),
          };
        }

        const repos = await reposResponse.json();

        // Map to entries
        const entries = repos.map((repo: any) => ({
          id: `${owner}/${repo.name}`,
          data: {
            repo: repo.name,
            url: repo.html_url,
            branch: repo.default_branch || "main",
            owner,
          },
        }));

        return {
          entries,
          cacheHint: {
            tags: [`github:${owner}`],
            lastModified: new Date(),
          },
        };
      } catch (error) {
        return {
          entries: [],
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },

    async loadEntry({ filter }) {
      const owner = filter.owner || DEFAULT_OWNER;
      const repo = filter.repo;
      const id = `${owner}/${repo}`;
      const result = await getReadmes().get(owner, repo);

      if (!result.ok) {
        return { id, data: null, error: new Error(result.error) };
      }

      return {
        id,
        data: { repo, url: `https://github.com/${owner}/${repo}`, branch: DEFAULT_REF, owner },
        rendered: { html: result.html },
        cacheHint: { tags: [`github:${owner}/${repo}`] },
      };
    },
  };
}
