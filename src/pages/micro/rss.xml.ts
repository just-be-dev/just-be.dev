import { getCollection } from "astro:content";
import rss from "@astrojs/rss";
import { SITE_TITLE } from "@/consts";

export async function GET(context) {
  const posts = await getCollection("micro");

  // Sort by createdAt descending (newest first)
  const sortedPosts = posts.sort((a, b) => b.data.createdAt.getTime() - a.data.createdAt.getTime());

  return rss({
    title: `${SITE_TITLE} - Micro`,
    description: "Short-form thoughts and updates",
    site: context.site,
    stylesheet: "/rss.xsl",
    items: sortedPosts.map((post) => ({
      description: post.data.content,
      pubDate: post.data.createdAt,
      link: `/micro/${post.id}`,
    })),
  });
}
