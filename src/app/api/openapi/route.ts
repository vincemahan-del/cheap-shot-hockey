import { ok } from "@/lib/api";

const SPEC = {
  openapi: "3.1.0",
  info: {
    title: "Cheap Shot Hockey API",
    version: "1.0.0",
    description:
      "REST API for the Cheap Shot Hockey demo store. Use the X-Demo-Mode header (slow|flaky|broken) to simulate latency or failures.",
  },
  servers: [{ url: "/" }],
  paths: {
    "/api/health": {
      get: {
        summary: "Service health check",
        responses: { "200": { description: "OK" } },
      },
    },
    "/api/products": {
      get: {
        summary: "List products",
        parameters: [
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "brand", in: "query", schema: { type: "string" } },
          { name: "position", in: "query", schema: { type: "string", enum: ["player", "goalie", "any"] } },
          { name: "hand", in: "query", schema: { type: "string", enum: ["left", "right", "n/a"] } },
          { name: "onSale", in: "query", schema: { type: "boolean" } },
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "minPriceCents", in: "query", schema: { type: "integer" } },
          { name: "maxPriceCents", in: "query", schema: { type: "integer" } },
        ],
        responses: { "200": { description: "OK" }, "503": { description: "Demo failure" } },
      },
    },
    "/api/products/{id}": {
      get: {
        summary: "Get a product by id or slug",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "OK" }, "404": { description: "Not found" } },
      },
    },
    "/api/cart": {
      get: { summary: "Get current cart", responses: { "200": { description: "OK" } } },
      post: {
        summary: "Add or update a cart line",
        description:
          "Use mode='add' to increment (each call adds the supplied quantity to the current line). Use mode='set' (default) to replace the line's quantity. Quantity 0 with mode='set' removes the line.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["productId", "quantity"],
                properties: {
                  productId: { type: "string" },
                  quantity: { type: "integer", minimum: 0 },
                  mode: {
                    type: "string",
                    enum: ["set", "add"],
                    default: "set",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "OK" },
          "400": { description: "Bad request" },
          "503": { description: "Demo failure" },
        },
      },
      delete: { summary: "Clear cart", responses: { "200": { description: "OK" } } },
    },
    "/api/orders": {
      get: {
        summary: "List orders",
        description:
          "Logged-in users get their own orders. Anonymous callers can pass ?email=<address> to look up guest orders.",
        parameters: [
          { name: "email", in: "query", schema: { type: "string", format: "email" } },
        ],
        responses: {
          "200": { description: "OK" },
          "401": { description: "Unauthorized (not logged in and no email provided)" },
        },
      },
      post: {
        summary: "Place an order (supports guest checkout)",
        description:
          "Logged-in users don't need customerEmail. Anonymous users MUST pass customerEmail — the order is created as a guest order and the session is issued a cookie that grants read access to that order on the current device.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["shippingAddress"],
                properties: {
                  customerEmail: {
                    type: "string",
                    format: "email",
                    description:
                      "Required for guest checkout, ignored when the caller is logged in.",
                  },
                  shippingAddress: {
                    type: "object",
                    required: ["name", "street", "city", "state", "postalCode", "country"],
                    properties: {
                      name: { type: "string" },
                      street: { type: "string" },
                      city: { type: "string" },
                      state: { type: "string" },
                      postalCode: { type: "string" },
                      country: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Created" },
          "400": { description: "Bad request" },
          "503": { description: "Demo failure" },
        },
      },
    },
    "/api/orders/{id}": {
      get: {
        summary: "Get a single order",
        description:
          "Accessible by the logged-in owner, admins, or by an anonymous caller on the same device that placed the guest order (via the csh_guest_orders cookie).",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "OK" },
          "403": { description: "Forbidden" },
          "404": { description: "Not found" },
        },
      },
    },
    "/api/auth/login": {
      post: {
        summary: "Log in with email and password",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "OK" }, "401": { description: "Invalid credentials" } },
      },
    },
    "/api/auth/logout": {
      post: { summary: "Log out", responses: { "200": { description: "OK" } } },
    },
    "/api/auth/me": {
      get: {
        summary: "Get the current session user",
        responses: { "200": { description: "OK" }, "401": { description: "Unauthorized" } },
      },
    },
    "/api/auth/register": {
      post: {
        summary: "Register a new account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password", "name"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                  name: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Created" },
          "400": { description: "Bad request" },
        },
      },
    },
    "/api/admin/orders": {
      get: {
        summary: "Admin: list all orders",
        responses: {
          "200": { description: "OK" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden" },
        },
      },
    },
    "/api/team-orders": {
      post: {
        summary: "Submit a team-orders quote request",
        description:
          "Accepts a quote-request payload from a club, school, or league; returns a quote ID for follow-up.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["orgName", "contactEmail", "sport", "estPlayers"],
                properties: {
                  orgName: { type: "string", minLength: 2, maxLength: 200 },
                  contactEmail: { type: "string", format: "email" },
                  sport: {
                    type: "string",
                    enum: ["hockey", "lacrosse", "field-hockey", "other"],
                  },
                  estPlayers: { type: "integer", minimum: 1, maximum: 500 },
                  message: { type: "string", maxLength: 2000 },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Created" },
          "400": { description: "Validation failed" },
          "503": { description: "Demo failure" },
        },
      },
    },
    "/api/deployments": {
      post: {
        summary: "Create a simulated deployment",
        description:
          "Starts a deployment that transitions queued → in_progress → successful|failure. The outcome is NOT selectable: it alternates by a per-session sequence counter held in the csh_deploy_seq cookie (even → success, odd → failure), so the caller can't choose whether a deploy passes — mirroring a real deployment tool. The decided outcome is baked into the returned label, so polling and label search are deterministic and serverless-safe (no server-side store).",
        parameters: [
          {
            name: "duration",
            in: "query",
            description: "Processing duration in seconds (1–180, default 10).",
            schema: { type: "integer", minimum: 1, maximum: 180, default: 10 },
          },
        ],
        responses: {
          "201": {
            description:
              "Created — returns the initial (queued) deployment state; Set-Cookie advances csh_deploy_seq",
          },
          "503": { description: "Demo failure" },
        },
      },
    },
    "/api/deployments/{label}": {
      get: {
        summary: "Poll a deployment's status",
        description:
          "Returns the deployment's current state (queued|in_progress|successful|failure) and progress (0–100), computed from the label and the current time. Poll on an interval until the status is terminal.",
        parameters: [{ name: "label", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "OK" },
          "404": { description: "Deployment not found (unparseable label)" },
          "503": { description: "Demo failure" },
        },
      },
    },
    "/api/deployments/search": {
      get: {
        summary: "Search for a deployment record by label",
        description:
          "Returns the deployment record ONLY when the deployment has succeeded; for a failed, still-running, or unknown label the record is null (nothing to show → downstream steps are skipped). Always 200.",
        parameters: [
          { name: "label", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "OK — { record } is the deployment record or null" },
        },
      },
    },
  },
};

export async function GET() {
  return ok(SPEC);
}
