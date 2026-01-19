---
skill: create-page
description: Create a new page in the appropriate content collection. Use when asked to create a page, post, reseach, talk, or project.
---

# Create Page Skill

You are helping create a new content page for this Astro website.

## Instructions

1. **Ask the user what type of content they want to create:**
   - `blog` - Blog post (goes in `src/content/blog/`)
   - `project` - Project entry (goes in `src/content/projects/`)
   - `research` - Research note (goes in `src/content/research/`)
   - `talk` - Talk/presentation (goes in `src/content/talks/`)
   - `page` - General page (goes in `src/content/pages/`)

2. **Get the current date:**
   - Run `date +%Y-%m-%d` to get today's date in ISO format
   - Use this date for all date fields

3. **Ask for required information based on content type:**

   ### Blog Posts
   - Ask for: **title** (required)
   - Include in frontmatter:
     - `title`: from user
     - `description`: empty string or infer from context if possible
     - `date`: current date
     - `tags`: empty array `[]`
     - `draft`: `true`

   ### Projects
   - Ask for: **title** (required)
   - Include in frontmatter:
     - `title`: from user
     - `description`: empty string or infer from context if possible
     - `url`: (leave empty or full URL if known)
     - `repository`: omit (leave empty) - must be a full URL if provided (e.g., "https://github.com/user/repo")
     - `status`: `"active"`
     - `date`: current date

   ### Research
   - Ask for: **title** (required)
   - Include in frontmatter:
     - `title`: from user
     - `description`: empty string or infer from context if possible
     - `date`: current date
     - `lastUpdated`: current date
     - `status`: `"draft"`
     - `topics`: empty array `[]`

   ### Talks
   - Ask for: **title** (required), **event** (required)
   - Include in frontmatter:
     - `title`: from user
     - `description`: empty string or infer from context if possible
     - `date`: current date
     - `event`: from user
     - `location`: empty string
     - `slides`: omit (optional field)
     - `audioPath`: omit (optional field)
     - `transcriptPath`: omit (optional field)

   ### Pages
   - Ask for: **filename** (required, e.g., "about" or "contact")
   - Include in frontmatter:
     - `title`: infer from filename if not obvious
     - `description`: empty string

4. **Generate filename from title:**
   - Convert title to lowercase
   - Replace spaces with hyphens
   - Remove special characters
   - Use this as the filename (e.g., "My New Post" → "my-new-post.mdx")
   - If it's too long, you can shorten it.
   - For pages, use the filename provided by the user

5. **Create the file:**
   - For blog/project/research/talk: Create as `src/content/{type}/{filename}.mdx` (WITHOUT the prefix)
   - For pages: Create as `src/content/pages/{filename}.mdx`
   - Include proper frontmatter based on the schema
   - Add a placeholder content section (e.g., "# {title}\n\nContent goes here.")

6. **Add the date prefix (for blog/project/research/talk only):**
   - Run `mise run prefix-codes` to automatically add the `{kind}{hex-date}--` prefix to the filename
   - This will rename the file from `{filename}.mdx` to `{kind}{hex-date}--{filename}.mdx`

7. **Confirm completion:**
   - Tell the user the final file path
   - Remind them they can now edit the content in the file

## Important Notes

- Ensure the title is capitalized correctly. (e.g., "Getting Started with Astro" instead of "getting started with astro")
- NEVER include the `{kind}{hex-date}--` prefix when creating the file - the `prefix-codes` script handles this automatically
- Always use `.mdx` extension for content files
- The date field is ALWAYS set to the current date (use `date +%Y-%m-%d`)
- Blog posts are ALWAYS created with `draft: true`
- Filename is auto-generated from the title (except for pages)
- Do NOT ask for optional fields - include them in frontmatter with sensible defaults or empty values
- Try to infer descriptions from context if the user mentioned what the content is about
- Omit truly optional fields (like `url`, `repository`, `slides`, etc.) rather than setting them to empty values

## Example Workflow

User wants to create a blog post titled "Getting Started with Astro":

1. Get current date: `date +%Y-%m-%d` → "2026-01-19"
2. Ask for title: "Getting Started with Astro"
3. Generate filename: "getting-started-with-astro.mdx"
4. Create file at `src/content/blog/getting-started-with-astro.mdx` with:
   - `title: "Getting Started with Astro"`
   - `description: ""`
   - `date: 2026-01-19`
   - `tags: []`
   - `draft: true`
5. Run `mise run prefix-codes`
6. File is renamed to something like `b232f--getting-started-with-astro.mdx`

If the user had said "I want to write a blog post about learning Astro framework", you could infer:

- `description: "A guide to learning the Astro framework"`
