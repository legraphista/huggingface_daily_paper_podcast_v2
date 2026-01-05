import { browser } from "../helpers/puppeteer.js";
import { downloadPapers } from "./index.js";

await downloadPapers();

await browser.close();

process.exit(0);