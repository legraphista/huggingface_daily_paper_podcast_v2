import { parseArgs } from "util";
import { browser } from "../helpers/puppeteer.js";
import { downloadPapers } from "./index.js";

const { values } = parseArgs({
    options: {
        wait: { type: "string", short: "w" },
    },
});

const waitSeconds = values.wait ? parseInt(values.wait, 10) : 0;

async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

let exitCode = 0;

try {
    await downloadPapers();
} catch (error) {
    console.error("Error during paper download:", error);
    exitCode = 1;
} finally {
    try {
        await browser.close();
    } catch (error) {
        console.error("Error closing browser:", error);
    }

    if (waitSeconds > 0) {
        console.log(`Waiting ${waitSeconds} seconds before exit...`);
        await sleep(waitSeconds * 1000);
    }

    process.exit(exitCode);
}
