// Jest Snapshot v1, https://goo.gl/fbAQLP

exports[`E2E join files with different extensions test with option: {
  name: 'first entrypoint is a json file',
  folder: 'json-and-yaml-input',
  entrypoints: [Array],
  snapshot: 'json-output.snapshot.js'
} 1`] = `

{
  "openapi": "3.0.0",
  "info": {
    "title": "Example API",
    "description": "This is an example API.",
    "version": "<version>"
  },
  "servers": [
    {
      "url": "https://redocly-example.com/api"
    }
  ],
  "tags": [
    {
      "name": "foo_other",
      "x-displayName": "other"
    },
    {
      "name": "bar_other",
      "x-displayName": "other"
    }
  ],
  "paths": {
    "/users/{userId}/orders/{orderId}": {
      "parameters": [
        {
          "name": "userId",
          "in": "path",
          "description": "ID of the user",
          "required": true,
          "schema": {
            "type": "integer"
          }
        },
        {
          "name": "orderId",
          "in": "path",
          "description": "ID of the order",
          "required": true,
          "schema": {
            "type": "integer"
          }
        }
      ],
      "get": {
        "x-private": true,
        "summary": "Get an order by ID for a specific user",
        "responses": {
          "200": {
            "description": "OK"
          },
          "404": {
            "description": "Not found"
          }
        },
        "tags": [
          "foo_other"
        ]
      }
    },
    "/users/{userId}": {
      "parameters": [
        {
          "name": "userId",
          "in": "path",
          "description": "ID of the user",
          "required": true,
          "schema": {
            "type": "integer"
          }
        }
      ],
      "get": {
        "summary": "Get user by ID",
        "responses": {
          "200": {
            "description": "OK"
          },
          "404": {
            "description": "Not found"
          }
        },
        "tags": [
          "bar_other"
        ]
      }
    }
  },
  "components": {},
  "x-tagGroups": [
    {
      "name": "foo",
      "tags": [
        "foo_other"
      ]
    },
    {
      "name": "bar",
      "tags": [
        "bar_other"
      ]
    }
  ]
}
openapi.json: join processed in <test>ms


`;
