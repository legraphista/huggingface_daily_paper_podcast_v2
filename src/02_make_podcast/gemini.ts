import { GoogleGenAI } from "@google/genai";
import { env } from "../helpers/env.js";

export const genAI = new GoogleGenAI({
    apiKey: env.GEMINI_API_KEY,
});

const availableTags = [ 
    // disable sniff, it's kinda broken
    // '[sniff]',
    '[gasp]',
    '[chuckle]',
    '[laugh]',
    '[groan]',
    '[cough]',
    '[shush]',
    '[sigh]',
    '[clear throat]',
]

export async function makePodcastScript(pdfPath: string) {
    console.log('Uploading PDF file to Gemini API ...', pdfPath);
    const pdfFile = await genAI.files.upload({
        file: pdfPath,
        config: {
            mimeType: "application/pdf",
        },
    })
    console.log('PDF file uploaded to Gemini API ...', pdfFile.name);
    const result = await genAI.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: [{
            role: "user",
            parts: [{
                fileData: {
                    fileUri: pdfFile.uri,
                }
            }],
        }],
        config: {
            systemInstruction: `
Create a podcast between 2 speakers: [S1][S2]

Each speaker:
- will have it's turn in a new line
- can use the following tags where appropriate (and no others) to convey emotion:
${availableTags.map(x => `  - ${x}`).join('\n')}

The podcast:
- should aim for around 30 minutes runtime
- be professional, engaging, informative, and with a touch of humor

Structure:
1. introduce the abstract
  - introduce the hosts. [S1] is Stefan, [S2] is Radu
  - name of the shot is Daily Hugging Face Papers
  - pick ${Math.random() > 0.5 ? '[S1]' : '[S2]'} to start the podcast
2. talk about the need
3. talk about how the paper solves that need
4. go in depth on the methodology
5. talk about findings and limitations
6. outro

Important rules:
- Use plain ASCII (e.g "—" is forbidden)
- Use "..." to denote a small pause in speech
- Do not use LaTeX or math notation like $x$ or $z_{t+1}$. Write math in plain text (e.g. "z sub t plus 1" or just "z t plus 1")

Output format:
- each line is a single speaker's turn
- the line starts with [S1] or [S2] to indicate the speaker, then continues with their text
`.trim(),
            tools: [
                { codeExecution: {} },
                { googleSearch: {} },
                { urlContext: {} },
            ]
        },
    });

    let script = result.text!;

    // Remove any [] tags that are not in availableTags and not [S1] or [S2]
    const allowedTags = new Set([...availableTags, '[S1]', '[S2]']);
    script = script.replace(/\[[^\]]+\]/g, (match) => 
        allowedTags.has(match) ? match : ''
    );

    return script.split('\n').map(x => x.trim()).filter(line => line).map(x => {
        const voice = x.startsWith('[S1]') ? 'stefan' as const : 'radu' as const;
        return {
            voice,
            text: x.replace('[S1]', '').replace('[S2]', '').trim(),
        } as const;
    });
}