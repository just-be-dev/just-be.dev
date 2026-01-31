export interface Env {
  ROUTING_RULES: KVNamespace;
  CONTENT_BUCKET: R2Bucket;
  ORIGIN_URL: string;
}

export type Handler<T> = (request: Request, env: Env, action: T) => Promise<Response>;
