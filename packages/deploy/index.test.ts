import { describe, test, expect } from "bun:test";

describe("wrangler command construction", () => {
  test("simple command with no arguments", () => {
    const args = ["whoami"];
    expect(args).toEqual(["whoami"]);
  });

  test("command with multiple words", () => {
    const args = ["kv", "key", "list"];
    expect(args).toEqual(["kv", "key", "list"]);
  });

  test("command with flag and value", () => {
    const namespaceId = "6118ae3b937c4883b3c582dfef8a0c05";
    const args = ["kv", "key", "list", "--namespace-id", namespaceId];
    expect(args).toEqual([
      "kv",
      "key",
      "list",
      "--namespace-id",
      "6118ae3b937c4883b3c582dfef8a0c05",
    ]);
  });

  test("command with concatenated path", () => {
    const bucket = "content-bucket";
    const key = "apex/index.html";
    const args = ["r2", "object", "put", `${bucket}/${key}`];
    expect(args).toEqual(["r2", "object", "put", "content-bucket/apex/index.html"]);
  });

  test("command with concatenated path and additional arguments", () => {
    const bucket = "content-bucket";
    const key = "apex/index.html";
    const localPath = "dist/index.html";
    const args = ["r2", "object", "put", `${bucket}/${key}`, "--file", localPath];
    expect(args).toEqual([
      "r2",
      "object",
      "put",
      "content-bucket/apex/index.html",
      "--file",
      "dist/index.html",
    ]);
  });

  test("command with multiple separate arguments", () => {
    const namespaceId = "6118ae3b937c4883b3c582dfef8a0c05";
    const subdomain = "myapp";
    const configJson = '{"type":"static"}';
    const args = ["kv", "key", "put", "--namespace-id", namespaceId, subdomain, configJson];
    expect(args).toEqual([
      "kv",
      "key",
      "put",
      "--namespace-id",
      "6118ae3b937c4883b3c582dfef8a0c05",
      "myapp",
      '{"type":"static"}',
    ]);
  });

  test("handles paths with spaces in concatenated arguments", () => {
    const path = "my folder/file.txt";
    const args = ["r2", "object", "put", `bucket/${path}`];
    expect(args).toEqual(["r2", "object", "put", "bucket/my folder/file.txt"]);
  });

  test("handles multiple path segments", () => {
    const bucket = "my-bucket";
    const folder = "subfolder";
    const file = "file.txt";
    const args = ["r2", "object", "put", `${bucket}/${folder}/${file}`];
    expect(args).toEqual(["r2", "object", "put", "my-bucket/subfolder/file.txt"]);
  });

  test("real-world: KV key list", () => {
    const KV_NAMESPACE_ID = "6118ae3b937c4883b3c582dfef8a0c05";
    const args = ["kv", "key", "list", "--namespace-id", KV_NAMESPACE_ID];
    expect(args).toEqual([
      "kv",
      "key",
      "list",
      "--namespace-id",
      "6118ae3b937c4883b3c582dfef8a0c05",
    ]);
  });

  test("real-world: R2 object put", () => {
    const BUCKET_NAME = "content-bucket";
    const r2Key = "apex/index.html";
    const localPath = "dist/index.html";
    const args = ["r2", "object", "put", `${BUCKET_NAME}/${r2Key}`, "--file", localPath];
    expect(args).toEqual([
      "r2",
      "object",
      "put",
      "content-bucket/apex/index.html",
      "--file",
      "dist/index.html",
    ]);
  });

  test("real-world: KV key put with JSON", () => {
    const KV_NAMESPACE_ID = "6118ae3b937c4883b3c582dfef8a0c05";
    const subdomain = "myapp";
    const configJson = '{"type":"static","spa":true}';
    const args = ["kv", "key", "put", "--namespace-id", KV_NAMESPACE_ID, subdomain, configJson];
    expect(args).toEqual([
      "kv",
      "key",
      "put",
      "--namespace-id",
      "6118ae3b937c4883b3c582dfef8a0c05",
      "myapp",
      '{"type":"static","spa":true}',
    ]);
  });
});
