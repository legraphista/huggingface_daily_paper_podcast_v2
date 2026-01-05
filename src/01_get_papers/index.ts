import { tqdm } from "../helpers/tqdm.js";
import { dateToPaperDate, Paper, PaperDate, state } from "../state.js";
import { getPapersForDay } from "./getPapers.js";
import { writeFileSync } from "fs";
import fetch from "node-fetch";

export async function downloadPapers() {
    // const now = new Date();
    // const date: PaperDate = dateToPaperDate(now);
    // const papers = await getPapersForDay(date);

    const papers = await getPapersForDay();

    let newPapers = 0;
    for (const paper of tqdm(papers, { description: 'Downloading papers' })) {
        if (!state.getPaper(paper.id)) {
            state.setPaper(paper.id, paper);
        }

        const p = Paper.fromId(paper.id);
        if (!p) {
            console.error(`Paper ${paper.id} not found`);
            continue;
        }

        if (!p.getState('downloadedPDF')) {
            console.log(`Downloading PDF for ${paper.id} from ${paper.pdfUrl}`);
            const pdf = await fetch(paper.pdfUrl);
            if (!pdf.ok) {
                console.error(`Failed to download PDF for ${paper.id}`);
                continue;
            }
            const buffer = await pdf.arrayBuffer();
            writeFileSync(p.pdfLocation(), Buffer.from(buffer));
            p.setState('downloadedPDF', true);
            newPapers++;
        }
    }

    console.log(`done, ${newPapers} new papers`);

    return newPapers;
}

