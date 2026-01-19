import type { LiveLoader } from "astro:content";
import { marked } from "marked";

const DEFAULT_OWNER = "just-be-dev";

// Custom renderer to style links like the Link component
const renderer = new marked.Renderer();
const originalLinkRenderer = renderer.link.bind(renderer);

renderer.link = function (href, title, text) {
  const isExternal = href?.startsWith("http");
  const html = originalLinkRenderer(href, title, text);

  // Add Link component styling classes and external link handling
  const styledHtml = html.replace(
    /<a /,
    `<a class="text-fg-0 link hocus:px-0.5 hocus:-mx-0.5 hocus:bg-0 hocus:invert decoration-current font-bold focus-visible:outline-none underline decoration-2" ${
      isExternal ? 'target="_blank" rel="noopener noreferrer"' : ""
    } `
  );

  // Add arrow for external links
  return isExternal ? styledHtml.replace(/<\/a>/, "↗</a>") : styledHtml;
};

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
          `https://api.github.com/users/${owner}/repos?per_page=100&type=public`
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
        // Fetch README from GitHub API
        const readmeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
          headers: {
            Accept: "application/vnd.github.v3+json",
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

        // Parse markdown to HTML using marked with custom renderer
        marked.setOptions({
          gfm: true,
          breaks: true,
          renderer: renderer,
        });
        const renderedHtml = await marked.parse(markdownWithoutH1);

        // Get the default branch from the API response
        const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
        const repoInfo = repoResponse.ok ? await repoResponse.json() : { default_branch: "main" };

        return {
          id: `${owner}/${repo}`,
          data: {
            repo,
            url: `https://github.com/${owner}/${repo}`,
            branch: repoInfo.default_branch || "main",
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
