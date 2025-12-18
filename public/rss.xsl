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
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@webtui/css@0.1.5/base.css"/>
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
            padding: 1.5lh 2ch 0;
            flex: 1;
            width: 100%;
          }

          .feed-info {
            margin-bottom: 2lh;
            background-color: var(--background1);
            border: 1px solid var(--foreground2);
          }

          .feed-info h2 {
            font-weight: bold;
            margin: 0;
          }

          .feed-info p {
            margin: 0;
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
            align-items: baseline;
            height: 1lh;
            padding: 0 1ch;
            margin: 0 -1ch;
            text-decoration: none;
            color: black;
            background-color: white;
            outline: none;
          }

          .posts a:hover,
          .posts a:focus {
            background-color: var(--accent);
            color: var(--background0);
            filter: invert(1);
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
            margin: 0;
          }

          .post-description {
            grid-column: 2 / -1;
            color: var(--foreground1);
            margin: 0;
          }

          .posts a:hover + .post-description,
          .posts a:focus + .post-description {
            color: var(--foreground0);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="feed-info">
            <h2>RSS Feed</h2>
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
