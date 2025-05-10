import { test, expect, describe, jest } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('MCP Browser Agent - Basic Tests', () => {
  test('Package should be properly configured', async () => {
    const packageJsonPath = path.join(rootDir, 'package.json');
    const packageJsonContent = await fs.promises.readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);
    
    expect(packageJson.name).toBe('mcp-browser-agent');
    expect(packageJson.type).toBe('module');
    expect(typeof packageJson.scripts.test).toBe('string');
  });
  
  test('Project should have required files', async () => {
    expect(fs.existsSync(path.join(rootDir, 'src/index.ts'))).toBeTruthy();
    expect(fs.existsSync(path.join(rootDir, 'src/executor.ts'))).toBeTruthy();
    expect(fs.existsSync(path.join(rootDir, 'src/tools.ts'))).toBeTruthy();
    expect(fs.existsSync(path.join(rootDir, 'src/handlers.ts'))).toBeTruthy();
  });
  
  test('Tools module should exist', async () => {
    const toolsPath = path.join(rootDir, 'src/tools.ts');
    expect(fs.existsSync(toolsPath)).toBeTruthy();

    const toolsContent = await fs.promises.readFile(toolsPath, 'utf8');
    expect(toolsContent).toContain('BROWSER_TOOLS');
    expect(toolsContent).toContain('browser_navigate');
    expect(toolsContent).toContain('browser_screenshot');
    expect(toolsContent).toContain('API_TOOLS');
    expect(toolsContent).toContain('api_get');
    expect(toolsContent).toContain('api_post');
  });
});
