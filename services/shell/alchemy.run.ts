import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Output from "alchemy/Output";
import { adopt } from "alchemy/AdoptPolicy";

/**
 * Browser-rendered SSH at https://shell.just-be.dev
 *
 * Architecture:
 *   browser -> Cloudflare edge (TLS 443)
 *           -> Access policy (one-time PIN)
 *           -> tunnel `retro` (outbound-only from the box)
 *           -> cloudflared -> sshd on localhost:22
 *
 * `retro` needs no inbound ports. Its egress allowlist is
 * cloudflared's edge endpoints + DNS.
 *
 * Constraint worth remembering: browser-rendered SSH requires the
 * Access email prefix to match the server username. `whoami` on
 * retro is `just-be`, so the identity must be just-be@just-be.dev.
 */
export default Alchemy.Stack(
  "Shell",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    // ---- Zone -------------------------------------------------------
    // Already exists in the account. Zones default to *retain* on
    // removal, so `alchemy destroy` will not delete it.
    const zone = yield* Cloudflare.Zone.Zone("JustBeDev", {
      name: "just-be.dev",
    }).pipe(adopt(true));

    // ---- Tunnel -----------------------------------------------------
    // `retro` already exists: created via the dashboard, connector
    // running on the box under systemd with `--token`. That makes it
    // remotely-managed, so the routing document below is authoritative.
    //
    // adopt(true) takes over the existing tunnel. A *create* in the
    // plan means you'd end up with two tunnels and a 404, since the
    // running connector would keep serving the old one.
    const tunnel = yield* Cloudflare.Tunnel.Tunnel("Retro", {
      name: "retro",
    }).pipe(adopt(true));

    // Ingress rules. This REPLACES the entire ordered list — anything
    // already routed through `retro` must be listed here or it stops
    // working. Rules match top-down, first match wins.
    //
    // The catch-all rule is appended automatically (Cloudflare rejects
    // a config whose last rule has a hostname).
    yield* Cloudflare.Tunnel.Configuration("RetroIngress", {
      tunnelId: tunnel.tunnelId,
      ingress: [
        { hostname: "shell.just-be.dev", service: "ssh://localhost:22" },
      ],
    });

    // ---- DNS --------------------------------------------------------
    // Output.interpolate, not a plain template literal: tunnelId isn't
    // known until deploy time and won't coerce to a string before then.
    //
    // `proxied: true` is load-bearing: traffic must enter Cloudflare's
    // edge to be forwarded down the tunnel.
    yield* Cloudflare.DNS.Record("ShellCname", {
      zoneId: zone.zoneId,
      name: "shell.just-be.dev",
      type: "CNAME",
      content: Output.interpolate`${tunnel.tunnelId}.cfargotunnel.com`,
      proxied: true,
    });

    // ---- Identity ---------------------------------------------------
    // One-time PIN rather than a social IdP: with Google/GitHub the
    // Access identity would be that provider's address, not
    // just-be@just-be.dev, and the username prefix match would fail.
    // OTP mails a code to whatever address is typed, which the
    // wildcard catch-all on just-be.dev delivers.
    //
    // adopt(true) because OTP is often already present in an account.
    const otp = yield* Cloudflare.Access.IdentityProvider("OneTimePin", {
      name: "One-time PIN login",
      type: "onetimepin",
      config: {},
    }).pipe(adopt(true));

    // ---- Policy -----------------------------------------------------
    // Pinned to the exact address, NOT emailDomain. With a catch-all,
    // a domain rule would make every address at just-be.dev a valid
    // login identity.
    const allowMe = yield* Cloudflare.Access.Policy("AllowJustBe", {
      name: "Allow just-be",
      decision: "allow",
      include: [{ email: { email: "just-be@just-be.dev" } }],
    });

    // ---- Access application ----------------------------------------
    // Only Allow/Block policies are supported for browser-rendered
    // apps; Bypass and Service Auth are not.
    //
    // sessionDuration governs the window for starting or refreshing a
    // connection, not the length of a live SSH session.
    const app = yield* Cloudflare.Access.Application("Shell", {
      type: "ssh",
      domain: "shell.just-be.dev",
      sessionDuration: "24h",
      allowedIdps: [otp.identityProviderId],
      autoRedirectToIdentity: true,
      policies: [allowMe.policyId],
    });

    return {
      url: "https://shell.just-be.dev",
      tunnelId: tunnel.tunnelId,
      // Redacted. Only needed if you ever re-provision the connector:
      //   cloudflared tunnel run --token <token>
      token: tunnel.token,
      applicationId: app.applicationId,
    };
  }),
);
