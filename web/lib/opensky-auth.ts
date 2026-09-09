import fs from "fs";
import path from "path";

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

interface OpenSkyCredentials {
  clientId: string;
  clientSecret: string;
}

/**
 * Resolves OpenSky credentials from environment variables or credentials.json files
 */
export function getOpenSkyCredentials(): OpenSkyCredentials | null {
  // 1. Check environment variables
  if (process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET) {
    return {
      clientId: process.env.OPENSKY_CLIENT_ID,
      clientSecret: process.env.OPENSKY_CLIENT_SECRET,
    };
  }

  // 2. Candidate credential file paths
  const candidatePaths = [
    path.resolve(process.cwd(), "credentials.json"),
    path.resolve(process.cwd(), "web/credentials.json"),
    path.resolve(process.cwd(), "opensky-credentials.json"),
    path.resolve(process.cwd(), "web/opensky-credentials.json"),
    path.resolve(process.cwd(), "../credentials.json"),
    path.resolve(process.cwd(), "../web/credentials.json"),
  ];

  for (const candidate of candidatePaths) {
    try {
      if (fs.existsSync(candidate)) {
        const raw = fs.readFileSync(candidate, "utf-8");
        const json = JSON.parse(raw);
        const clientId = json.clientId || json.client_id;
        const clientSecret = json.clientSecret || json.client_secret;
        if (clientId && clientSecret) {
          return { clientId, clientSecret };
        }
      }
    } catch {
      // Continue searching next candidate path
    }
  }

  return null;
}

/**
 * Retrieves a valid OpenSky OAuth2 Bearer Access Token with in-memory caching
 */
export async function getOpenSkyBearerToken(): Promise<string | null> {
  const now = Date.now();

  // Reuse cached token if valid for at least another 60 seconds
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.accessToken;
  }

  const credentials = getOpenSkyCredentials();
  if (!credentials) {
    return null;
  }

  try {
    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");
    params.append("client_id", credentials.clientId);
    params.append("client_secret", credentials.clientSecret);

    const tokenRes = await fetch(
      "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: params.toString(),
      }
    );

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("[OpenSky Auth] Token exchange failed:", tokenRes.status, errText);
      return null;
    }

    const data = (await tokenRes.json()) as {
      access_token?: string;
      expires_in?: number;
    };

    if (!data.access_token) {
      console.error("[OpenSky Auth] Missing access_token in response:", data);
      return null;
    }

    const expiresInMs = (data.expires_in ?? 1800) * 1000;
    cachedToken = {
      accessToken: data.access_token,
      expiresAt: now + expiresInMs,
    };

    return cachedToken.accessToken;
  } catch (err) {
    console.error("[OpenSky Auth] Error acquiring bearer token:", err);
    return null;
  }
}
