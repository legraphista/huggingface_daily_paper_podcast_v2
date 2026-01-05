import assert from "assert";
import { dateToPaperDate, PaperData, PaperDate } from "../state.js";
import { browser } from "../helpers/puppeteer.js";

export async function getPapersForDay(date?: PaperDate): Promise<PaperData[]> {
    const page = await browser.newPage();

    try {
        console.log(`Getting papers for ${date ?? 'today'}`);

        try {
            const url = date
                ? `https://huggingface.co/papers?date=${date}`
                : 'https://huggingface.co/papers';

            console.log(`Navigating to ${url}`);
            await page.goto(url);
        } catch (e) {
            console.error('nagivation didn\'t finish');
            console.error(e);
            console.error('could still be good, sometimes the page loads forever but thre is still content due to pending images')

            // check if there's an a with href containing '/papers' with text "Daily Papers"
            const dailyPapersLink = await page.$('a[href="/papers"]');
            const dailyPapersLinkText = await dailyPapersLink?.evaluate((element) => element.innerText);
            if (dailyPapersLinkText?.toString().trim() === 'Daily Papers') {
                console.log('found daily papers link, page is good');
            } else {
                console.log('no daily papers link found, page is bad');
                throw new Error('no daily papers link found, page is bad: ' + page.url());
            }
        }

        // wait for the page to load
        await page.waitForSelector('article');

        const truePageDateStr = await page.$eval('a[href^="/papers/date/"]', (element) => element.getAttribute('href')?.replace('/papers/date/', ''));
        assert(truePageDateStr, 'No date found');
        const truePageDate: PaperDate = dateToPaperDate(new Date(truePageDateStr));
        console.log(`True page date: ${truePageDate}`);

        // get the papers
        const links = await page.$$eval('article', (elements) => {
            return elements.map((element) => {
                const a = element.querySelector('a');
                if (!a) return null;

                const id = a.getAttribute('href')?.split('/').pop();
                const url = `https://huggingface.co/papers/${id}`;

                return { url, id };
            });
        }).then(x => x.filter(x => x !== null) as { url: string, id: string }[]);

        console.log(`Found ${links.length} papers`);

        const papers: PaperData[] = [];
        for (const { url, id } of links) {
            if (!url || !id) continue;

            await page.goto(url);

            const title = await page.$eval('h1', (element) => element.innerText);

            // find button with text "View PDF"
            const pdfButton = await page.$('a[href*="pdf"]');
            if (!pdfButton) continue;

            // get pdf url
            const pdfUrl = await pdfButton.evaluateHandle((element) => element.href).then(x => x.jsonValue());
            if (!pdfUrl) continue;

            const abstractContainer = await page.$('body > div.flex.min-h-dvh.flex-col > main > div > section.pt-8.border-gray-100.md\\:col-span-7.sm\\:pb-16.lg\\:pb-24.relative > div > div.pb-8.pr-4.md\\:pr-16');
            let abstract = await abstractContainer?.evaluate((element) => element.innerText) ?? '';
            if (abstract.toString().indexOf('Abstract') == 0) {
                // it's an abstract
                abstract = abstract.toString().slice('Abstract'.length).trim();
            } else {
                // it's not an abstract
                abstract = '';
            }


            papers.push({
                id,
                title: (title ?? url).trim().replaceAll('\n', ' ').replaceAll('  ', ' '),
                url,
                pdfUrl,
                date: truePageDate,
                abstract
            });
        }


        return papers;
    } catch (e) {
        throw e;
    } finally {
        await page.close();
    }
}