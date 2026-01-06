import { parseArgs } from "util";
import { browser } from "../helpers/puppeteer.js";
import { PaperState, state } from "../state.js";
import { publishToSpotify } from "./spotify.js";
import { sleep } from "../helpers/async.js";

const { values } = parseArgs({
    options: {
        wait: { type: "string", short: "w" },
    },
});

const waitSeconds = values.wait ? parseInt(values.wait, 10) : 0;

let exitCode = 0;

function filterPapers(paperState: PaperState) {
    return !!paperState.processedPodcast && !paperState.publishedToSpotify;
}

try {
    while (true) {
        const paper = state.findByState(filterPapers);
        if (!paper) break;
        
        const papersUnpublished = state.countByState(filterPapers);
        console.group(`Publishing to Spotify ${paper?.id} (left: ${papersUnpublished})`);

        await publishToSpotify(paper);
        paper.setState('publishedToSpotify', true);

        console.log(`Published to Spotify ${paper.id}`);
        console.groupEnd();

        await sleep(1000);
    }
} catch (error) {
    console.error("Error during podcast publishing:", error);
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
