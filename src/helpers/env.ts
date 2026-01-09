import { config } from "dotenv";

config();

export const env = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    HEADLESS: process.env.HEADLESS === 'true' || process.env.HEADLESS === '1' || process.env.HEADLESS === 'yes',
    BROWSER_DATA_DIR: process.env.BROWSER_DATA_DIR || 'data/.browser_data',
};