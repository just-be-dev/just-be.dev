import rss from "@astrojs/rss";
import { SITE_TITLE } from "@/consts";
import { microStore } from "@/lib/micro.ts";

export const prerender = false;

export async function GET(context) {
  const env = context.locals.runtime.env;
  const storage = microStore(env.MICRO_DB);
  const posts = await storage.readPosts();

  // Sort by createdAt descending (newest first)
  posts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return rss({
    title: `${SITE_TITLE} - Micro`,
    description: "Short-form thoughts and updates",
    site: context.site,
    stylesheet: "/rss.xsl",
    items: posts.map((post) => ({
      title: post.content.length > 80 ? post.content.slice(0, 80) + "..." : post.content,
      description: post.content,
      pubDate: post.createdAt,
      link: `/micro#${post.id}`,
    })),
  });
}
