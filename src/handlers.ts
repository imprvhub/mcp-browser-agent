import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { 
  ListResourcesRequestSchema, 
  ReadResourceRequestSchema, 
  ListToolsRequestSchema, 
  CallToolRequestSchema,
  Tool
} from "@modelcontextprotocol/sdk/types.js";
import { executeToolCall, getBrowserLogs, getScreenshotRegistry } from "./executor.js";

export function setupHandlers(server: Server, tools: Tool[]) {
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const resources = [
      {
        uri: "browser://logs",
        mimeType: "text/plain",
        name: "Browser console logs",
      }
    ];
    
    const screenshots = getScreenshotRegistry();
    for (const name of screenshots.keys()) {
      resources.push({
        uri: `screenshot://${name}`,
        mimeType: "image/png",
        name: `Screenshot: ${name}`,
      });
    }
    return { resources };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri.toString();
    if (uri === "browser://logs") {
      return {
        contents: [{
          uri,
          mimeType: "text/plain",
          text: getBrowserLogs().join("\n"),
        }],
      };
    }

    if (uri.startsWith("screenshot://")) {
      const name = uri.split("://")[1];
      const screenshot = getScreenshotRegistry().get(name);
      if (screenshot) {
        return {
          contents: [{
            uri,
            mimeType: "image/png",
            blob: screenshot,
          }],
        };
      }
    }

    throw new Error(`Resource not found: ${uri}`);
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return executeToolCall(
      request.params.name, 
      request.params.arguments ?? {}, 
      server
    );
  });
}