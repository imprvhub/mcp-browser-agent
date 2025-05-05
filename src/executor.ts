import { chromium, firefox, webkit, Browser, Page, request, APIRequestContext, BrowserType } from "playwright";
import { CallToolResult, TextContent, ImageContent } from "@modelcontextprotocol/sdk/types.js";
import { BROWSER_TOOLS, API_TOOLS } from "./tools.js";
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

let browser: Browser | null = null;
let page: Page | null = null;
const browserLogs: string[] = [];
const screenshotRegistry = new Map<string, string>();
const defaultDownloadsPath = path.join(os.homedir(), 'Downloads');

const getBrowserType = (): string => {
  if (process.env.MCP_BROWSER_TYPE) {
    return process.env.MCP_BROWSER_TYPE.toLowerCase();
  }
  
  try {
    const configPath = path.join(os.homedir(), '.mcp_browser_agent_config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.browserType) {
        return config.browserType.toLowerCase();
      }
    }
  } catch (error) {
    console.error('Error reading config file:', error);
  }
  
  return 'chrome';
};

export function getBrowserLogs(): string[] {
  return browserLogs;
}

export function getScreenshotRegistry(): Map<string, string> {
  return screenshotRegistry;
}

process.on('SIGINT', async () => {
  await cleanupBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await cleanupBrowser();
  process.exit(0);
});

async function cleanupBrowser() {
  if (browser) {
    try {
      await browser.close();
      browser = null;
      page = null;
      console.log('Browser instance closed successfully');
    } catch (error) {
      console.error('Error closing browser:', error);
    }
  }
}

async function initBrowser(): Promise<Page> {
  if (!browser) {
    const browserType = getBrowserType();
    let browserInstance: BrowserType;
    
    switch (browserType) {
      case 'firefox':
        browserInstance = firefox;
        break;
      case 'webkit':
      case 'safari':
        browserInstance = webkit;
        break;
      case 'chrome':
      case 'chromium':
      default:
        browserInstance = chromium;
        break;
    }
    
    browser = await browserInstance.launch({ 
      headless: false,
      channel: browserType === 'chrome' ? 'chrome' : undefined
    });
    
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    });

    page = await context.newPage();
    page.on("console", (msg) => {
      const logEntry = `[${msg.type()}] ${msg.text()}`;
      browserLogs.push(logEntry);
    });
  }
  return page!;
}

async function initApiClient(baseUrl: string): Promise<APIRequestContext> {
  return await request.newContext({
    baseURL: baseUrl,
  });
}

async function getResponseData(response: any): Promise<TextContent[]> {
  const contentType = response.headers()['content-type'] || '';
  let responseText: string;
  if (contentType.includes('application/json')) {
    try {
      const json = await response.json();
      responseText = JSON.stringify(json, null, 2);
    } catch (e) {
      responseText = await response.text();
    }
  } else {
    responseText = await response.text();
  }
  return [{
    type: "text",
    text: `Response body:\n${responseText}`,
  } as TextContent];
}

export async function executeToolCall(
  toolName: string,
  args: any,
  server: any
): Promise<{ toolResult: CallToolResult }> {
  try {
    const isBrowserTool = BROWSER_TOOLS.includes(toolName);
    const isApiTool = API_TOOLS.includes(toolName);

    let activePage: Page | null = null;
    let apiClient: APIRequestContext | null = null;

    if (isBrowserTool) {
      activePage = await initBrowser();
    }

    if (isApiTool) {
      apiClient = await initApiClient(args.url);
    }

    switch (toolName) {

      case "browser_navigate":
        return await handleBrowserNavigate(activePage!, args);

      case "browser_screenshot":
        return await handleBrowserScreenshot(activePage!, args, server);

      case "browser_click":
        return await handleBrowserClick(activePage!, args);

      case "browser_fill":
        return await handleBrowserFill(activePage!, args);

      case "browser_select":
        return await handleBrowserSelect(activePage!, args);

      case "browser_hover":
        return await handleBrowserHover(activePage!, args);

      case "browser_evaluate":
        return await handleBrowserEvaluate(activePage!, args);

      case "api_get":
        return await handleApiGet(apiClient!, args);

      case "api_post":
        return await handleApiPost(apiClient!, args);

      case "api_put":
        return await handleApiPut(apiClient!, args);

      case "api_patch":
        return await handleApiPatch(apiClient!, args);

      case "api_delete":
        return await handleApiDelete(apiClient!, args);

      default:
        return {
          toolResult: {
            content: [{
              type: "text",
              text: `Unknown tool: ${toolName}`,
            }],
            isError: true,
          },
        };
    }
  } catch (error) {
    return {
      toolResult: {
        content: [{
          type: "text",
          text: `Tool execution error: ${(error as Error).message}`,
        }],
        isError: true,
      },
    };
  }
}

async function handleBrowserNavigate(page: Page, args: any): Promise<{ toolResult: CallToolResult }> {
  try {
    await page.goto(args.url, {
      timeout: args.timeout || 30000,
      waitUntil: args.waitUntil || "load"
    });
    return {
      toolResult: {
        content: [{
          type: "text",
          text: `Navigated to ${args.url}`,
        }],
        isError: false,
      },
    };
  } catch (error) {
    return {
      toolResult: {
        content: [{
          type: "text",
          text: `Navigation failed: ${(error as Error).message}`,
        }],
        isError: true,
      },
    };
  }
}

async function handleBrowserScreenshot(page: Page, args: any, server: any): Promise<{ toolResult: CallToolResult }> {
  try {
    const options: any = {
      type: "png",
      fullPage: !!args.fullPage
    };

    if (args.selector) {
      const element = await page.$(args.selector);
      if (!element) {
        return {
          toolResult: {
            content: [{
              type: "text",
              text: `Element not found: ${args.selector}`,
            }],
            isError: true,
          },
        };
      }
      options.element = element;
    }

    if (args.mask && Array.isArray(args.mask)) {
      options.mask = await Promise.all(
        args.mask.map(async (selector: string) => await page.$(selector))
      );
    }

    const screenshot = await page.screenshot(options);
    const base64Screenshot = screenshot.toString('base64');
    const responseContent: (TextContent | ImageContent)[] = [];
    const savePath = args.savePath || defaultDownloadsPath;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${args.name}-${timestamp}.png`;
    const filePath = path.join(savePath, filename);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, screenshot);
    responseContent.push({
      type: "text",
      text: `Screenshot saved to: ${filePath}`,
    } as TextContent);

    screenshotRegistry.set(args.name, base64Screenshot);
    server.notification({
      method: "notifications/resources/list_changed",
    });

    responseContent.push({
      type: "image",
      data: base64Screenshot,
      mimeType: "image/png",
    } as ImageContent);

    return {
      toolResult: {
        content: responseContent,
        isError: false,
      },
    };
  } catch (error) {
    return {
      toolResult: {
        content: [{
          type: "text",
          text: `Screenshot failed: ${(error as Error).message}`,
        }],
        isError: true,
      },
    };
  }
}

async function handleBrowserClick(page: Page, args: any): Promise<{ toolResult: CallToolResult }> {
  try {
    await page.click(args.selector);
    return {
      toolResult: {
        content: [{
          type: "text",
          text: `Clicked element: ${args.selector}`,
        }],
        isError: false,
      },
    };
  } catch (error) {
    return {
      toolResult: {
        content: [{
          type: "text",
          text: `Click failed on ${args.selector}: ${(error as Error).message}`,
        }],
        isError: true,
      },
    };
  }
}

async function handleBrowserFill(page: Page, args: any): Promise<{ toolResult: CallToolResult }> {
  try {
    await page.waitForSelector(args.selector);
    await page.fill(args.selector, args.value);
    return {
      toolResult: {
        content: [{
          type: "text",
          text: `Filled ${args.selector} with: ${args.value}`,
        }],
        isError: false,
      },
    };
  } catch (error) {
    return {
      toolResult: {
        content: [{
          type: "text",
          text: `Fill operation failed on ${args.selector}: ${(error as Error).message}`,
        }],
        isError: true,
      },
    };
  }
}

async function handleBrowserSelect(page: Page, args: any): Promise<{ toolResult: CallToolResult }> {
  try {
    await page.waitForSelector(args.selector);
    await page.selectOption(args.selector, args.value);
    return {
      toolResult: {
        content: [{
          type: "text",
          text: `Selected option ${args.value} in ${args.selector}`,
        }],
        isError: false,
      },
    };
  } catch (error) {
    return {
      toolResult: {
        content: [{
          type: "text",
          text: `Selection failed on ${args.selector}: ${(error as Error).message}`,
        }],
        isError: true,
      },
    };
  }
}

async function handleBrowserHover(page: Page, args: any): Promise<{ toolResult: CallToolResult }> {
  try {
    await page.waitForSelector(args.selector);
    await page.hover(args.selector);
    return {
      toolResult: {
        content: [{
          type: "text",
          text: `Hovered over element: ${args.selector}`,
        }],
        isError: false,
      },
    };
  } catch (error) {
    return {
      toolResult: {
        content: [{
          type: "text",
          text: `Hover failed on ${args.selector}: ${(error as Error).message}`,
        }],
        isError: true,
      },
    };
  }
}

async function handleBrowserEvaluate(page: Page, args: any): Promise<{ toolResult: CallToolResult }> {
  try {
    const result = await page.evaluate((script) => {

      const logs: string[] = [];
      const originalConsole = { ...console };


      ['log', 'info', 'warn', 'error'].forEach(method => {
        (console as any)[method] = (...args: any[]) => {
          logs.push(`[${method}] ${args.join(' ')}`);
          (originalConsole as any)[method](...args);
        };
      });

      try {

        const result = eval(script);

        Object.assign(console, originalConsole);
        return { result, logs };
      } catch (error) {

        Object.assign(console, originalConsole);
        throw error;
      }
    }, args.script);

    return {
      toolResult: {
        content: [
          {
            type: "text",
            text: `Script result: ${JSON.stringify(result.result, null, 2)}`,
          },
          {
            type: "text",
            text: `Console output:\n${result.logs.join('\n')}`,
          }
        ],
        isError: false,
      },
    };
  } catch (error) {
    return {
      toolResult: {
        content: [{
          type: "text",
          text: `Script execution failed: ${(error as Error).message}`,
        }],
        isError: true,
      },
    };
  }
}

async function handleApiGet(client: APIRequestContext, args: any): Promise<{ toolResult: CallToolResult }> {
  try {
    const options = args.headers ? { headers: args.headers } : undefined;
    const response = await client.get(args.url, options);
    const responseData = await getResponseData(response);

    return {
      toolResult: {
        content: [
          {
            type: "text",
            text: `GET ${args.url} - Status: ${response.status()}`,
          },
          ...responseData
        ],
        isError: false,
      },
    };
  } catch (error) {
    return {
      toolResult: {
        content: [{
          type: "text",
          text: `GET request failed: ${(error as Error).message}`,
        }],
        isError: true,
      },
    };
  }
}

async function handleApiPost(client: APIRequestContext, args: any): Promise<{ toolResult: CallToolResult }> {
  try {
    const options = {
      data: args.data,
      headers: args.headers || { 'Content-Type': 'application/json' }
    };

    const response = await client.post(args.url, options);
    const responseData = await getResponseData(response);

    return {
      toolResult: {
        content: [
          {
            type: "text",
            text: `POST ${args.url} - Status: ${response.status()}`,
          },
          ...responseData
        ],
        isError: false,
      },
    };
  } catch (error) {
    return {
      toolResult: {
        content: [{
          type: "text",
          text: `POST request failed: ${(error as Error).message}`,
        }],
        isError: true,
      },
    };
  }
}

async function handleApiPut(client: APIRequestContext, args: any): Promise<{ toolResult: CallToolResult }> {
  try {
    const options = {
      data: args.data,
      headers: args.headers || { 'Content-Type': 'application/json' }
    };

    const response = await client.put(args.url, options);
    const responseData = await getResponseData(response);

    return {
      toolResult: {
        content: [
          {
            type: "text",
            text: `PUT ${args.url} - Status: ${response.status()}`,
          },
          ...responseData
        ],
        isError: false,
      },
    };
  } catch (error) {
    return {
      toolResult: {
        content: [{
          type: "text",
          text: `PUT request failed: ${(error as Error).message}`,
        }],
        isError: true,
      },
    };
  }
}

async function handleApiPatch(client: APIRequestContext, args: any): Promise<{ toolResult: CallToolResult }> {
  try {
    const options = {
      data: args.data,
      headers: args.headers || { 'Content-Type': 'application/json' }
    };

    const response = await client.patch(args.url, options);
    const responseData = await getResponseData(response);

    return {
      toolResult: {
        content: [
          {
            type: "text",
            text: `PATCH ${args.url} - Status: ${response.status()}`,
          },
          ...responseData
        ],
        isError: false,
      },
    };
  } catch (error) {
    return {
      toolResult: {
        content: [{
          type: "text",
          text: `PATCH request failed: ${(error as Error).message}`,
        }],
        isError: true,
      },
    };
  }
}

async function handleApiDelete(client: APIRequestContext, args: any): Promise<{ toolResult: CallToolResult }> {
  try {
    const options = args.headers ? { headers: args.headers } : undefined;
    const response = await client.delete(args.url, options);
    return {
      toolResult: {
        content: [
          {
            type: "text",
            text: `DELETE ${args.url} - Status: ${response.status()}`,
          }
        ],
        isError: false,
      },
    };
  } catch (error) {
    return {
      toolResult: {
        content: [{
          type: "text",
          text: `DELETE request failed: ${(error as Error).message}`,
        }],
        isError: true,
      },
    };
  }
}