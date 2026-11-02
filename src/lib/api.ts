import type { Assignment, Bracelet, Episode, Fix, NewAssignment, Person, Zone } from "./types";

/**
 * Backend base URL. NEXT_PUBLIC_ variables are baked in at build time (see .env.example).
 * The backend must list this dashboard's address in its CORS_ORIGINS.
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Thin wrapper around fetch that sends the admin key on every request. */
export class Api {
  constructor(private readonly apiKey: string) {}

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${API_URL}${path}`, {
        method,
        headers: {
          "x-api-key": this.apiKey,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
      });
    } catch {
      // fetch only throws when the server can't be reached at all (or CORS blocks it).
      throw new ApiError(0, "Server tidak dapat dihubungi");
    }
    if (!response.ok) {
      throw new ApiError(response.status, `Permintaan gagal (HTTP ${response.status})`);
    }
    return (await response.json()) as T;
  }

  /** Used by the login screen: any authenticated endpoint tells us whether the key is right. */
  checkKey(): Promise<unknown> {
    return this.request("GET", "/settings");
  }

  zones(): Promise<Zone[]> {
    return this.request("GET", "/zones");
  }

  latestFixes(): Promise<Fix[]> {
    return this.request("GET", "/fixes/latest");
  }

  openAlerts(): Promise<Episode[]> {
    return this.request("GET", "/alerts?open=true");
  }

  openAssignments(): Promise<Assignment[]> {
    return this.request("GET", "/assignments?open=true");
  }

  acknowledge(alertId: number): Promise<Episode> {
    return this.request("POST", `/alerts/${alertId}/acknowledge`);
  }

  bracelets(): Promise<Bracelet[]> {
    return this.request("GET", "/bracelets");
  }

  inmates(): Promise<Person[]> {
    return this.request("GET", "/inmates");
  }

  guards(): Promise<Person[]> {
    return this.request("GET", "/guards");
  }

  startAssignment(input: NewAssignment): Promise<Assignment> {
    return this.request("POST", "/assignments", input);
  }

  endAssignment(assignmentId: number): Promise<Assignment> {
    return this.request("POST", `/assignments/${assignmentId}/end`);
  }
}
