import { browser } from "../helpers/puppeteer.js";
import { state } from "../state.js";
import { publishToSpotify } from "./spotify.js";
const papersToProcess = state.listByState(paperState => !paperState.publishedToSpotify);
import { tqdm } from "../helpers/tqdm.js";
import { sleep } from "../helpers/async.js";


for (let i = 0; i < papersToProcess.length; i++) {
    const paper = papersToProcess[i];
    console.group(`Publishing to Spotify ${i + 1} of ${papersToProcess.length} (${paper.id})`);

    await publishToSpotify(paper);
    paper.setState('publishedToSpotify', true);

    console.log(`Published to Spotify ${paper.id}`);
    console.groupEnd();

    sleep(1000);
}