#!/usr/bin/env bun

/**
 * Generate JSON Schema for deploy.json using Zod's built-in toJSONSchema
 */

import { toJSONSchema } from "zod";
import { DeployConfigSchema } from "../index.ts";

// Generate JSON Schema from Zod schema using built-in function
const jsonSchema = toJSONSchema(DeployConfigSchema);

// Enhance with custom metadata
const schema = {
  ...jsonSchema,
  title: "Deploy Configuration",
  description:
    "Configuration for deploying static sites and setting up routing for the wildcard subdomain service",
};

// Write to schema.json in parent directory
await Bun.write(new URL("../schema.json", import.meta.url), JSON.stringify(schema, null, 2));

console.log("✓ Generated schema.json using Zod's toJSONSchema");
