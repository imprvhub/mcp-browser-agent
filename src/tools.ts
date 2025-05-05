import { Tool } from "@modelcontextprotocol/sdk/types.js";

export const BROWSER_TOOLS = [
  "browser_navigate",
  "browser_screenshot",
  "browser_click",
  "browser_fill",
  "browser_select",
  "browser_hover",
  "browser_evaluate"
];

export const API_TOOLS = [
  "api_get",
  "api_post",
  "api_put",
  "api_patch",
  "api_delete"
];

export function registerTools(): Tool[] {
  return [
    {
      name: "browser_navigate",
      description: "Navigate to a specific URL",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL to navigate to" },
          timeout: { type: "number", description: "Navigation timeout in milliseconds" },
          waitUntil: { 
            type: "string", 
            description: "Navigation wait criteria",
            enum: ["load", "domcontentloaded", "networkidle", "commit"]
          }
        },
        required: ["url"]
      }
    },
    {
      name: "browser_screenshot",
      description: "Capture a screenshot of the current page or a specific element",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Identifier for the screenshot" },
          selector: { type: "string", description: "CSS selector for element to capture" },
          fullPage: { type: "boolean", description: "Capture full page height" },
          mask: { 
            type: "array", 
            description: "Selectors for elements to mask",
            items: { type: "string" }
          },
          savePath: { type: "string", description: "Path to save screenshot (default: user's Downloads folder)" }
        },
        required: ["name"]
      }
    },
    {
      name: "browser_click",
      description: "Click an element on the page",
      inputSchema: {
        type: "object",
        properties: {
          selector: { type: "string", description: "CSS selector for element to click" }
        },
        required: ["selector"]
      }
    },
    {
      name: "browser_fill",
      description: "Fill a form input with text",
      inputSchema: {
        type: "object",
        properties: {
          selector: { type: "string", description: "CSS selector for input field" },
          value: { type: "string", description: "Text to enter in the field" }
        },
        required: ["selector", "value"]
      }
    },
    {
      name: "browser_select",
      description: "Select an option from a dropdown menu",
      inputSchema: {
        type: "object",
        properties: {
          selector: { type: "string", description: "CSS selector for select element" },
          value: { type: "string", description: "Value or label to select" }
        },
        required: ["selector", "value"]
      }
    },
    {
      name: "browser_hover",
      description: "Hover over an element on the page",
      inputSchema: {
        type: "object",
        properties: {
          selector: { type: "string", description: "CSS selector for element to hover over" }
        },
        required: ["selector"]
      }
    },
    {
      name: "browser_evaluate",
      description: "Execute JavaScript in the browser context",
      inputSchema: {
        type: "object",
        properties: {
          script: { type: "string", description: "JavaScript code to execute" }
        },
        required: ["script"]
      }
    },

    {
      name: "api_get",
      description: "Perform a GET request to an API endpoint",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "API endpoint URL" },
          headers: { 
            type: "object", 
            description: "Request headers",
            additionalProperties: { type: "string" }
          }
        },
        required: ["url"]
      }
    },
    {
      name: "api_post",
      description: "Perform a POST request to an API endpoint",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "API endpoint URL" },
          data: { type: "string", description: "Request body data (JSON string)" },
          headers: { 
            type: "object", 
            description: "Request headers",
            additionalProperties: { type: "string" }
          }
        },
        required: ["url", "data"]
      }
    },
    {
      name: "api_put",
      description: "Perform a PUT request to an API endpoint",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "API endpoint URL" },
          data: { type: "string", description: "Request body data (JSON string)" },
          headers: { 
            type: "object", 
            description: "Request headers",
            additionalProperties: { type: "string" }
          }
        },
        required: ["url", "data"]
      }
    },
    {
      name: "api_patch",
      description: "Perform a PATCH request to an API endpoint",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "API endpoint URL" },
          data: { type: "string", description: "Request body data (JSON string)" },
          headers: { 
            type: "object", 
            description: "Request headers",
            additionalProperties: { type: "string" }
          }
        },
        required: ["url", "data"]
      }
    },
    {
      name: "api_delete",
      description: "Perform a DELETE request to an API endpoint",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "API endpoint URL" },
          headers: { 
            type: "object", 
            description: "Request headers",
            additionalProperties: { type: "string" }
          }
        },
        required: ["url"]
      }
    }
  ];
}