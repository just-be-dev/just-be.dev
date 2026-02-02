import { describe, test, expect } from "bun:test";
import { tokenizeCommand } from "./index";

describe("tokenizeCommand", () => {
  test("simple command with no interpolation", () => {
    const result = tokenizeCommand`whoami`;
    expect(result).toEqual(["whoami"]);
  });

  test("command with multiple words", () => {
    const result = tokenizeCommand`kv key list`;
    expect(result).toEqual(["kv", "key", "list"]);
  });

  test("command with single interpolated value", () => {
    const namespaceId = "6118ae3b937c4883b3c582dfef8a0c05";
    const result = tokenizeCommand`kv key list --namespace-id ${namespaceId}`;
    expect(result).toEqual([
      "kv",
      "key",
      "list",
      "--namespace-id",
      "6118ae3b937c4883b3c582dfef8a0c05",
    ]);
  });

  test("command with concatenated values (slash separator)", () => {
    const bucket = "content-bucket";
    const key = "apex/index.html";
    const result = tokenizeCommand`r2 object put ${bucket}/${key}`;
    expect(result).toEqual(["r2", "object", "put", "content-bucket/apex/index.html"]);
  });

  test("command with concatenated values and additional flags", () => {
    const bucket = "content-bucket";
    const key = "apex/index.html";
    const localPath = "dist/index.html";
    const result = tokenizeCommand`r2 object put ${bucket}/${key} --file ${localPath}`;
    expect(result).toEqual([
      "r2",
      "object",
      "put",
      "content-bucket/apex/index.html",
      "--file",
      "dist/index.html",
    ]);
  });

  test("command with multiple space-separated interpolated values", () => {
    const namespaceId = "6118ae3b937c4883b3c582dfef8a0c05";
    const subdomain = "myapp";
    const configJson = '{"type":"static"}';
    const result = tokenizeCommand`kv key put --namespace-id ${namespaceId} ${subdomain} ${configJson}`;
    expect(result).toEqual([
      "kv",
      "key",
      "put",
      "--namespace-id",
      "6118ae3b937c4883b3c582dfef8a0c05",
      "myapp",
      '{"type":"static"}',
    ]);
  });

  test("handles paths with spaces in values", () => {
    const path = "my folder/file.txt";
    const result = tokenizeCommand`r2 object put bucket/${path}`;
    expect(result).toEqual(["r2", "object", "put", "bucket/my folder/file.txt"]);
  });

  test("handles multiple slashes between values", () => {
    const bucket = "my-bucket";
    const folder = "subfolder";
    const file = "file.txt";
    const result = tokenizeCommand`r2 object put ${bucket}/${folder}/${file}`;
    expect(result).toEqual(["r2", "object", "put", "my-bucket/subfolder/file.txt"]);
  });

  test("handles empty interpolated values", () => {
    const empty = "";
    const result = tokenizeCommand`kv key list ${empty} --some-flag`;
    expect(result).toEqual(["kv", "key", "list", "--some-flag"]);
  });

  test("handles numeric values", () => {
    const count = 42;
    const result = tokenizeCommand`kv key list --limit ${count}`;
    expect(result).toEqual(["kv", "key", "list", "--limit", "42"]);
  });

  test("handles trailing and leading whitespace", () => {
    const value = "test";
    const result = tokenizeCommand`  command   ${value}  `;
    expect(result).toEqual(["command", "test"]);
  });

  test("handles tabs and newlines as whitespace", () => {
    const value = "test";
    const result = tokenizeCommand`command\t${value}\nflag`;
    expect(result).toEqual(["command", "test", "flag"]);
  });

  test("preserves concatenation with special characters", () => {
    const bucket = "bucket";
    const key = "path/to/file.txt";
    const result = tokenizeCommand`r2 object put ${bucket}:${key}`;
    expect(result).toEqual(["r2", "object", "put", "bucket:path/to/file.txt"]);
  });

  test("real-world example: KV key list", () => {
    const KV_NAMESPACE_ID = "6118ae3b937c4883b3c582dfef8a0c05";
    const result = tokenizeCommand`kv key list --namespace-id ${KV_NAMESPACE_ID}`;
    expect(result).toEqual([
      "kv",
      "key",
      "list",
      "--namespace-id",
      "6118ae3b937c4883b3c582dfef8a0c05",
    ]);
  });

  test("real-world example: R2 object put with path", () => {
    const BUCKET_NAME = "content-bucket";
    const r2Key = "apex/index.html";
    const localPath = "dist/index.html";
    const result = tokenizeCommand`r2 object put ${BUCKET_NAME}/${r2Key} --file ${localPath}`;
    expect(result).toEqual([
      "r2",
      "object",
      "put",
      "content-bucket/apex/index.html",
      "--file",
      "dist/index.html",
    ]);
  });

  test("real-world example: KV key put with JSON", () => {
    const KV_NAMESPACE_ID = "6118ae3b937c4883b3c582dfef8a0c05";
    const subdomain = "myapp";
    const configJson = '{"type":"static","spa":true}';
    const result = tokenizeCommand`kv key put --namespace-id ${KV_NAMESPACE_ID} ${subdomain} ${configJson}`;
    expect(result).toEqual([
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
