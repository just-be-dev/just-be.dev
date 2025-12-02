import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.md' }),
	schema: z.object({
		title: z.string(),
		description: z.string().optional(),
		date: z.coerce.date(),
		tags: z.array(z.string()).default([]),
		draft: z.boolean().default(false),
	}),
});

const projects = defineCollection({
	loader: glob({ base: './src/content/projects', pattern: '**/*.md' }),
	schema: z.object({
		title: z.string(),
		description: z.string().optional(),
		url: z.string().url().optional(),
		repository: z.string().url().optional(),
		status: z.enum(['active', 'completed', 'archived', 'maintenance']).default('active'),
		technologies: z.array(z.string()).default([]),
		startDate: z.coerce.date().optional(),
		endDate: z.coerce.date().optional(),
	}),
});

const research = defineCollection({
	loader: glob({ base: './src/content/research', pattern: '**/*.md' }),
	schema: z.object({
		title: z.string(),
		description: z.string().optional(),
		date: z.coerce.date().optional(),
		lastUpdated: z.coerce.date().optional(),
		status: z.enum(['draft', 'published', 'archived']).default('draft'),
		topics: z.array(z.string()).default([]),
	}),
});

const pages = defineCollection({
	loader: glob({ base: './src/content/pages', pattern: '**/*.md' }),
	schema: z.object({
		title: z.string().optional(),
		description: z.string().optional(),
	}),
});

export const collections = { blog, projects, research, pages };
