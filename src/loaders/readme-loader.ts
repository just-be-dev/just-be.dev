import type { Loader } from "astro/loaders";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export function readmeLoader(): Loader {
  return {
    name: "github-readme-loader",
    load: async ({ store, renderMarkdown, logger }) => {
      // Read project files directly from filesystem
      const projectsDir = join(process.cwd(), "src/content/projects");
      const files = await readdir(projectsDir);
      const mdxFiles = files.filter((f) => f.endsWith(".mdx") || f.endsWith(".md"));

      // Parse frontmatter to extract repository URLs
      const githubRepos: string[] = [];

      for (const file of mdxFiles) {
        try {
          const content = await readFile(join(projectsDir, file), "utf-8");
          const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

          if (frontmatterMatch) {
            const frontmatter = frontmatterMatch[1];
            const repoMatch = frontmatter.match(/repository:\s*["']?(https:\/\/github\.com\/[^"'\n]+)["']?/);

            if (repoMatch) {
              githubRepos.push(repoMatch[1]);
            }
          }
        } catch (error) {
          logger.warn(`Failed to parse ${file}: ${error}`);
        }
      }

      logger.info(`Found ${githubRepos.length} projects with GitHub repositories`);

      // Clear existing entries
      store.clear();

      // Fetch README for each GitHub project
      for (const repoUrl of githubRepos) {

        // Extract owner/repo from GitHub URL
        const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (!match) {
          logger.warn(`Could not parse GitHub URL: ${repoUrl}`);
          continue;
        }

        const owner = match[1];
        let repo = match[2];

        // Remove .git suffix if present
        if (repo.endsWith(".git")) {
          repo = repo.slice(0, -4);
        }

        const repoId = `${owner}/${repo}`;

        logger.info(`Fetching README for ${repoId}...`);

        try {
          // Try fetching from main branch first
          let readmeContent: string | null = null;
          let branch = "main";

          const mainUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`;
          const mainResponse = await fetch(mainUrl);

          if (mainResponse.ok) {
            readmeContent = await mainResponse.text();
          } else if (mainResponse.status === 404) {
            // Try master branch as fallback
            branch = "master";
            const masterUrl = `https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`;
            const masterResponse = await fetch(masterUrl);

            if (masterResponse.ok) {
              readmeContent = await masterResponse.text();
            } else {
              logger.warn(`README not found for ${repoId} (tried main and master branches)`);
              continue;
            }
          } else {
            logger.warn(
              `Failed to fetch README for ${repoId}: ${mainResponse.status} ${mainResponse.statusText}`
            );
            continue;
          }

          if (!readmeContent) {
            continue;
          }

          // Render markdown using Astro's pipeline
          const rendered = await renderMarkdown(readmeContent);

          // Store in collection
          store.set({
            id: repoId,
            data: {
              repo: repoId,
              url: repoUrl,
              branch,
              fetchedAt: new Date(),
            },
            rendered,
          });

          logger.info(`✓ Successfully loaded README for ${repoId}`);
        } catch (error) {
          logger.error(
            `Error fetching README for ${repoId}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      logger.info(`README loader complete: ${store.values().length} READMEs loaded`);
    },
  };
}
