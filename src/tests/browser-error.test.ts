import { test, expect, describe, jest, beforeAll } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const processEvents: Record<string, Array<() => void>> = {
  'SIGINT': [],
  'SIGTERM': []
};

let cleanupFn: boolean | undefined;

beforeAll(() => {
  const executorPath = path.join(rootDir, 'src/executor.ts');
  const executorContent = fs.readFileSync(executorPath, 'utf8');
  if (executorContent.includes('process.on(\'SIGINT\'')) {
    processEvents['SIGINT'] = [() => {}];
  }
  
  if (executorContent.includes('process.on(\'SIGTERM\'')) {
    processEvents['SIGTERM'] = [() => {}];
  }
  
  if (executorContent.includes('cleanupBrowser')) {
    cleanupFn = true;
  }
});

describe('Browser Error Handling Tests', () => {
  test('Executor should contain process cleanup handlers', async () => {
    const executorPath = path.join(rootDir, 'src/executor.ts');
    const executorContent = fs.readFileSync(executorPath, 'utf8');
    expect(executorContent.includes('process.on(\'SIGINT\'')).toBeTruthy();
    expect(executorContent.includes('process.on(\'SIGTERM\'')).toBeTruthy();
    expect(executorContent.includes('cleanupBrowser')).toBeTruthy();
  });

  test('README should contain browser process cleanup documentation', () => {
    const readmePath = path.join(rootDir, 'README.md');
    const readmeContent = fs.readFileSync(readmePath, 'utf8');
    expect(readmeContent).toContain('Browser process not closing properly');
    expect(readmeContent).toContain('Windows');
    expect(readmeContent).toContain('macOS');
    expect(readmeContent).toContain('Linux');
    expect(readmeContent).toContain('Playwright');
    expect(readmeContent).toContain('issues');
    expect(readmeContent).toContain('github.com/microsoft/playwright/issues');
  });
});
