import type { Loader } from "astro/loaders";

export function readmeLoader(): Loader {
  return {
    name: "github-readme-loader",
    load: async ({ store, renderMarkdown, logger }) => {
      // Import getCollection dynamically to ensure projects collection is available
      const { getCollection } = await import("astro:content");

      // Get all projects
      const projects = await getCollection("projects");

      // Filter projects with GitHub repository URLs
      const githubProjects = projects.filter((project) => {
        const repo = project.data.repository;
        return repo && typeof repo === "string" && repo.includes("github.com");
      });

      logger.info(`Found ${githubProjects.length} projects with GitHub repositories`);

      // Clear existing entries
      store.clear();

      // Fetch README for each GitHub project
      for (const project of githubProjects) {
        const repoUrl = project.data.repository as string;

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
