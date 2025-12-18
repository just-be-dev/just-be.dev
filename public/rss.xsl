<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:atom="http://www.w3.org/2005/Atom">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html lang="en">
      <head>
        <title><xsl:value-of select="/rss/channel/title"/> - RSS Feed</title>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,700;1,400&amp;display=swap"/>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@webtui/css@latest/base.css"/>
        <style>
          * {
            font-family: "IBM Plex Mono", "JetBrains Mono", "Fira Code", "Cascadia Code", "Consolas", "Monaco", "Courier New", monospace;
            font-size: 1rem;
            line-height: 1.5;
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 0;
            background-color: var(--background0);
            color: var(--foreground0);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
          }

          .container {
            max-width: 768px;
            margin: 0 auto;
            padding: 0 2ch;
            flex: 1;
            width: 100%;
          }

          header {
            padding-top: 1.5lh;
            margin-bottom: 2lh;
          }

          h1 {
            font-weight: bold;
            margin: 0 0 1.5lh 0;
          }

          .feed-info {
            margin-bottom: 3lh;
            padding: 1lh 2ch;
            background-color: var(--background1);
            border: 1px solid var(--foreground2);
          }

          .feed-info h2 {
            font-weight: bold;
            margin: 0 0 1lh 0;
          }

          .feed-info p {
            margin: 0 0 0.5lh 0;
            color: var(--foreground1);
          }

          .feed-info a {
            color: var(--accent);
            text-decoration: underline;
          }

          .feed-info a:hover {
            background-color: var(--accent);
            color: var(--background0);
          }

          .posts {
            list-style: none;
            padding: 0;
            margin: 0;
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 0 2ch;
          }

          .posts li {
            display: contents;
          }

          .posts a {
            grid-column: 1 / -1;
            display: grid;
            grid-template-columns: subgrid;
            padding: 0 1ch;
            margin: 0 -1ch;
            text-decoration: none;
            color: inherit;
            outline: none;
          }

          .posts a:hover,
          .posts a:focus {
            background-color: var(--accent);
            color: var(--background0);
          }

          .post-date {
            white-space: nowrap;
            color: var(--foreground2);
          }

          .posts a:hover .post-date,
          .posts a:focus .post-date {
            color: var(--background0);
          }

          .post-title {
            font-weight: bold;
          }

          .post-description {
            grid-column: 1 / -1;
            padding-left: 1ch;
            color: var(--foreground1);
            margin-bottom: 1lh;
          }

          .posts a:hover + .post-description,
          .posts a:focus + .post-description {
            color: var(--foreground0);
          }

          nav {
            margin-bottom: 1.5lh;
            display: flex;
            gap: 2ch;
          }

          nav a {
            color: var(--foreground1);
            text-decoration: none;
          }

          nav a:hover,
          nav a:focus {
            color: var(--accent);
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <header>
            <nav>
              <a href="/">~/</a>
              <a href="/blog">blog</a>
              <a href="/projects">projects</a>
              <a href="/research">research</a>
            </nav>
            <h1>~/blog/rss.xml</h1>
          </header>

          <div class="feed-info">
            <h2>📡 RSS Feed</h2>
            <p><xsl:value-of select="/rss/channel/description"/></p>
            <p>Subscribe to this feed in your RSS reader: <a href="/rss.xml">https://just-be.dev/rss.xml</a></p>
          </div>

          <main>
            <ul class="posts">
              <xsl:for-each select="/rss/channel/item">
                <li>
                  <a>
                    <xsl:attribute name="href">
                      <xsl:value-of select="link"/>
                    </xsl:attribute>
                    <span class="post-date">
                      <xsl:value-of select="substring(pubDate, 1, 16)"/>
                    </span>
                    <h2 class="post-title">
                      <xsl:value-of select="title"/>
                    </h2>
                  </a>
                  <xsl:if test="description">
                    <p class="post-description">
                      <xsl:value-of select="description"/>
                    </p>
                  </xsl:if>
                </li>
              </xsl:for-each>
            </ul>
          </main>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
