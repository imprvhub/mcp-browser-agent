const { chromium } = require('playwright');

async function test() {
  console.log('Starting browser test in Docker environment...');

  const isDocker = require('fs').existsSync('/.dockerenv') || 
    (require('fs').existsSync('/proc/1/cgroup') && 
     require('fs').readFileSync('/proc/1/cgroup', 'utf8').includes('docker'));
  
  console.log(`Running in Docker environment: ${isDocker}`);
  
  try {
    const browser = await chromium.launch({ headless: true });
    console.log('Browser launched successfully');
    const context = await browser.newContext();
    const page = await context.newPage();
    console.log('Browser page created successfully');
    await page.goto('https://example.com');
    console.log('Navigation successful');
    await page.screenshot({ path: '/tmp/example.png' });
    console.log('Screenshot saved to /tmp/example.png');
    const title = await page.title();
    console.log(`Page title: ${title}`);
    await browser.close();
    console.log('Browser closed successfully');
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

test();
