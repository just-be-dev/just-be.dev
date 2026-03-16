import type { LiveLoader } from "astro:content";
import { marked } from "marked";

const DEFAULT_OWNER = "just-be-dev";
const USER_AGENT = "just-be-dev-website";

/**
 * Creates a custom renderer that handles both external and relative links
 */
function createRenderer(owner: string, repo: string, branch: string) {
  const renderer = new marked.Renderer();
  const originalLinkRenderer = renderer.link.bind(renderer);

  renderer.link = function (token) {
    const html = originalLinkRenderer(token);
    let href = token.href;

    if (!href) {
      return html;
    }

    // Handle absolute external links
    if (href.startsWith("http://") || href.startsWith("https://")) {
      return html.replace(/<a /, '<a target="_blank" rel="noopener noreferrer" ');
    }

    // Handle anchor links (keep as is)
    if (href.startsWith("#")) {
      return html;
    }

    // Convert relative links to absolute GitHub URLs
    // Remove leading ./ if present
    const cleanPath = href.replace(/^\.\//, "");
    const absoluteUrl = `https://github.com/${owner}/${repo}/blob/${branch}/${cleanPath}`;

    return html.replace(
      /href="[^"]*"/,
      `href="${absoluteUrl}" target="_blank" rel="noopener noreferrer"`,
    );
  };

  return renderer;
}

/**
 * Strips the first H1 heading from markdown content
 */
function stripFirstH1(markdown: string): string {
  // Match the first H1 (# heading) and remove it along with trailing newlines
  return markdown.replace(/^#\s+.*?(\r?\n)+/, "");
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

      try {
        // Get the default branch from the API response first
        const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          headers: { "User-Agent": USER_AGENT },
        });
        const repoInfo = repoResponse.ok ? await repoResponse.json() : { default_branch: "main" };
        const branch = repoInfo.default_branch || "main";

        // Fetch README from GitHub API
        const readmeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
          headers: {
            Accept: "application/vnd.github.v3+json",
            "User-Agent": USER_AGENT,
          },
        });

        if (!readmeResponse.ok) {
          if (readmeResponse.status === 404) {
            return {
              id: `${owner}/${repo}`,
              data: null,
              error: new Error(`README not found for ${owner}/${repo}`),
            };
          }
          return {
            id: `${owner}/${repo}`,
            data: null,
            error: new Error(`Failed to fetch README: ${readmeResponse.status}`),
          };
        }

        const readmeData = await readmeResponse.json();

        // Decode base64 content
        const readmeMarkdown = atob(readmeData.content);

        // Strip the first H1 heading
        const markdownWithoutH1 = stripFirstH1(readmeMarkdown);

        // Create renderer with repo context for relative links
        const renderer = createRenderer(owner, repo, branch);

        // Parse markdown to HTML using marked
        marked.setOptions({
          gfm: true,
          breaks: true,
          renderer: renderer,
        });
        const renderedHtml = await marked.parse(markdownWithoutH1);

        return {
          id: `${owner}/${repo}`,
          data: {
            repo,
            url: `https://github.com/${owner}/${repo}`,
            branch,
            owner,
          },
          rendered: {
            html: renderedHtml,
          },
          cacheHint: {
            tags: [`github:${owner}/${repo}`],
            lastModified: new Date(),
          },
        };
      } catch (error) {
        return {
          id: `${owner}/${repo}`,
          data: null,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },
  };
}
