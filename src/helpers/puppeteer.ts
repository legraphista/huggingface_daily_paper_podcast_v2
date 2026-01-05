import { existsSync, readFileSync } from "fs";
import { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { env } from "./env.js";

const stealth = StealthPlugin()
stealth.enabledEvasions.delete('iframe.contentWindow')
stealth.enabledEvasions.delete('media.codecs')
puppeteer.default.use(stealth);


// login to google account
// @ts-expect-error this code is shit :)
export let browser: Browser = null;

// const cookiesFile = existsSync(".data/cookies.json") ? readFileSync(".data/cookies.json", "utf-8") : "[]";
// const cookies = JSON.parse(cookiesFile);
// for (const cookie of cookies) {
//     await browser.setCookie(cookie);
// }

export async function reloadBrowser(headless: boolean = env.HEADLESS): Promise<Browser> {
    await browser?.close();

    try {
        return browser = await puppeteer.default.launch({
            // executablePath: '/usr/bin/chromium-browser',
            protocolTimeout: 15 * 60 * 1000,
            headless,
            userDataDir: 'data/.browser_data',
            ignoreDefaultArgs: ['--enable-automation', '--disable-extensions', '--disable-default-apps', '--disable-component-extensions-with-background-pages'],
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Add these arguments for Linux environments
        });
    } catch (e) {
        console.error('error reloading browser, check if you need to set HEADLESS=1');
        throw e;
    }
}

browser = await reloadBrowser();