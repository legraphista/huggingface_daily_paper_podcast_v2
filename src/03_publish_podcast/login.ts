import { sleep } from "../helpers/async.js";
import { browser } from "../helpers/puppeteer.js";

const page = await browser.newPage();

await page.goto('https://creators.spotify.com/pod/dashboard/home');

while (!page.isClosed()) {
    await sleep(1000);
}

browser.close();

