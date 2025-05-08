#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";
import { setupHandlers } from "./handlers.js";
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const parseArgs = () => {
  const args = process.argv.slice(2);
  let browserType = null;
  let viewportWidth = null;
  let viewportHeight = null;
  let deviceScaleFactor = null;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--browser' && i + 1 < args.length) {
      browserType = args[i + 1].toLowerCase();
    }
    if (args[i] === '--viewport-width' && i + 1 < args.length) {
      viewportWidth = parseInt(args[i + 1], 10);
    }
    if (args[i] === '--viewport-height' && i + 1 < args.length) {
      viewportHeight = parseInt(args[i + 1], 10);
    }
    if (args[i] === '--device-scale-factor' && i + 1 < args.length) {
      deviceScaleFactor = parseFloat(args[i + 1]);
    }
  }
  
  try {
    const configPath = path.join(os.homedir(), '.mcp_browser_agent_config.json');
    const config = fs.existsSync(configPath) 
      ? JSON.parse(fs.readFileSync(configPath, 'utf8')) 
      : {};
    
    if (browserType) {
      process.env.MCP_BROWSER_TYPE = browserType;
      config.browserType = browserType;
    }
    
    if (viewportWidth) {
      process.env.MCP_VIEWPORT_WIDTH = viewportWidth.toString();
      config.viewportWidth = viewportWidth;
    }
    
    if (viewportHeight) {
      process.env.MCP_VIEWPORT_HEIGHT = viewportHeight.toString();
      config.viewportHeight = viewportHeight;
    }
    
    if (deviceScaleFactor) {
      process.env.MCP_DEVICE_SCALE_FACTOR = deviceScaleFactor.toString();
      config.deviceScaleFactor = deviceScaleFactor;
    }
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error saving config:', error);
  }
};

async function startServer() {
  parseArgs();
  const server = new Server(
    {
      name: "mcp-browser-agent",
      version: "0.1.0",
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    }
  );

  const tools = registerTools();
  setupHandlers(server, tools);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

startServer().catch(error => {
  console.error("Server error:", error);
  process.exit(1);
});