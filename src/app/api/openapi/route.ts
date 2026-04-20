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
        summary: "List the current user's orders",
        responses: { "200": { description: "OK" }, "401": { description: "Unauthorized" } },
      },
      post: {
        summary: "Place an order from the current cart",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["shippingAddress"],
                properties: {
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
          "401": { description: "Unauthorized" },
          "503": { description: "Demo failure" },
        },
      },
    },
    "/api/orders/{id}": {
      get: {
        summary: "Get a single order",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "OK" },
          "401": { description: "Unauthorized" },
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
  },
};

export async function GET() {
  return ok(SPEC);
}
