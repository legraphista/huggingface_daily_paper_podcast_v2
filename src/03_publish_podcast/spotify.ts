import { browser, reloadBrowser } from "../helpers/puppeteer.js";
import assert from "node:assert";
import { Paper, state } from "../state.js";
import { tqdm } from "../helpers/tqdm.js";
import { Page } from "puppeteer";
import { sleep } from "../helpers/async.js";

await reloadBrowser(false);

async function publishPodcast(page: Page, paper: Paper) {

    await page.goto('https://creators.spotify.com/pod/dashboard/episode/wizard');

    console.log('waiting for file input');
    const fileInput = await page.waitForSelector('input[id="uploadAreaInput"]');
    assert(fileInput, 'input not found');
    await fileInput.uploadFile(paper.podcastLocation());

    // sleep a bit while the page loads
    await sleep(1000);

    console.log('waiting for title input');
    const titleInput = await page.waitForSelector('input[name="title"]');
    assert(titleInput, 'title input not found');
    await titleInput.focus();

    const title = `${paper.paper.title} - ${paper.paper.date}`
        .replaceAll('\n', ' ')
        .replaceAll('  ', ' ')
        .trim();

    await titleInput.type(title, { delay: 50 });

    // cool down
    await sleep(1000);

    console.log('waiting for description input');
    const descriptionInput = await page.waitForSelector('div[name="description"]');
    assert(descriptionInput, 'description input not found');
    await descriptionInput.focus();

    let abstract = paper.paper.abstract;
    if (abstract?.length && abstract.length > 3500) {
        abstract = abstract.slice(0, 3500) + '...';
    }

    const description = `
You can find the paper and discussion at: ${paper.paper.url}

${(abstract ? abstract.trim() + '\n\n' : '')}\
---

Music: Deep Blue - Synths & Percussion Version by Ben Fox
`

    await descriptionInput.type(description.trim(), { delay: 50 });

    console.log('waiting for next button');
    const nextButton = await page.waitForSelector('button[type="submit"]');
    assert(nextButton, 'next button not found');
    await nextButton.click();

    console.log('waiting for publish now input');
    const inputPublishNow = await page.waitForSelector('input[id="publish-date-now"]');
    assert(inputPublishNow, 'publish now input not found');
    await inputPublishNow.click();

    await sleep(1000);

    console.log('waiting for publish button');
    const publishButton = await page.waitForSelector('button[data-encore-id="buttonPrimary"]:not([disabled])', { timeout: 60 * 1000 });
    assert(publishButton, 'publish button not found');
    await publishButton.click();

    console.log('waiting for publish confirmation');
    await sleep(5000);
}

export async function publishToSpotify(paper: Paper) {

    const page = await browser.newPage();
    await page.goto('https://creators.spotify.com/pod/dashboard/home');

    const name = await page.waitForSelector('span.encore-text-title-small');
    const nameText = await name?.evaluate(el => el.textContent);

    // assert(nameText?.trim() === 'Daily Huggingface Papers!', 'bad name: ' + nameText);

    await publishPodcast(page, paper);

    console.log('done publishing to spotify');

    await page.close();
}