import type { Env, Handler } from "../types";
import type { RedirectConfig } from "../schemas";

export const handleRedirect: Handler<RedirectConfig> = async (request, env, config) => {
  const status = config.permanent ? 301 : 302;
  return Response.redirect(config.url, status);
};
