---
title: APIs in the Age of AI
date: 2025-03-31
tags: [ai, mcp, api]
---

Building good APIs is hard. There's a never-ending stream of debates about how to build proper RESTful services. GraphQL, despite its promise, is complex to scale and comes with its own baggage. RPC is back in vogue, but it's not ideal for public consumption. Consuming an API can be just as hard. There's a reason companies like [Stainless](https://www.stainless.com/), who generate high-quality SDKs from OpenAPI specs, exist.

I think we're on the cusp of a seismic shift in how people interact with software services. Steve Manuel, CEO of Dylibso, wrote a post called MCP: The Differential for Modern APIs and Systems where he describes Anthropic's Model Context Protocol (MCP) as a kind of fuzzy interface between users and the systems they want to interact with. MCP is essentially a protocol that describes how LLMs can interact with software services. It's worth reading more about.

The core idea is simple: you have an MCP server—either local or hosted—that wraps an API. You plug the MCP server's URL into your LLM-enabled tool (like Claude Desktop, Cursor, Zed, etc.) and then you can just ask it to do something. The tool interprets your intent and executes it via the MCP endpoint.

Here's where things get interesting. Imagine you're working on a big file full of TODOs and you want to track them in GitHub. You plug in mcp.github.com to your editor's MCP config and prompt it:

> Turn all the TODOs in this file into GitHub issues.

Your editor + LLM combo uses GitHub's MCP interface to handle the rest. No need to read API docs, understand request schemas, or install an SDK. In 30 seconds, your intent becomes reality.

This is possible today. Go to mcp.run, install the GitHub servlet, copy the MCP server URL, plug it into your editor, and you're off. But here's the catch: that servlet is just a third-party wrapper around GitHub's API. If GitHub ships a breaking change, the servlet breaks.

What I think is coming—soon—is that companies will begin shipping first-party MCP support directly into their products. The GitHub team (and others) could make MCP a core part of their interface strategy: a semantic wrapper around their internal APIs, updated and maintained by the same people who build the underlying functionality. Forget the old tension between internal vs. external APIs. This is a new category: semantic interfaces designed for LLM-first consumption.

I'm not saying APIs are going away (nor should they). But I do think, for better or worse, integrated MCPs will become a key part of how we interact with software going forward.
