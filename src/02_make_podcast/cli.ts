import path from "path";
import { makePodcastScript } from "./gemini.js";
import { mkdir, readFile, writeFile, rm } from "fs/promises";
import { existsSync } from "fs";
import { generateVoice as generateVoice, raduVoiceBuffer, stefanVoiceBuffer } from "./voices.js";
import { mergeAudioFiles } from "./ffmpeg.js";
import { state, Paper } from "../state.js";

// Parse arguments
const args = process.argv.slice(2);
const paperIdIndex = args.indexOf('--paper-id');
const forcePaperId = paperIdIndex !== -1 ? args[paperIdIndex + 1] : null;
const removeScript = args.includes('--remove-script');
const clearAudioAfterMerge = !args.includes('--keep-audio');

let papersToProcess: Paper[];

if (forcePaperId) {
    const paper = state.getPaper(forcePaperId);
    if (!paper || !paper.paper) {
        console.error(`Paper with id "${forcePaperId}" not found`);
        process.exit(1);
    }
    papersToProcess = [paper];
    
    // Clean up old audio files for force reprocess
    const audioFolder = path.join(paper.locationOnDisk(), 'audio');
    if (existsSync(audioFolder)) {
        console.log(`Removing old audio files from ${audioFolder}...`);
        await rm(audioFolder, { recursive: true });
    }
    
    // Remove old script if flag is set
    if (removeScript) {
        const scriptPath = paper.scriptLocation();
        if (existsSync(scriptPath)) {
            console.log(`Removing old script at ${scriptPath}...`);
            await rm(scriptPath);
        }
    }
    
    // Remove old podcast
    const podcastPath = paper.podcastLocation();
    if (existsSync(podcastPath)) {
        console.log(`Removing old podcast at ${podcastPath}...`);
        await rm(podcastPath);
    }
    
    console.log(`Force reprocessing paper: ${forcePaperId}`);
} else {
    papersToProcess = state.listByState(paperState => !paperState.processedPodcast);
}

for (let i = 0; i < papersToProcess.length; i++) {
    const paper = papersToProcess[i];

    const scriptPath = paper.scriptLocation();
    const pdfPath = paper.pdfLocation();

    let script: { voice: 'stefan' | 'radu', text: string }[] = [];
    if (!existsSync(scriptPath)) {
        console.log('Generating script for paper ...', paper.id, pdfPath);
        script = await makePodcastScript(pdfPath);
        await writeFile(scriptPath, JSON.stringify(script, null, 2));
    } else {
        script = JSON.parse(await readFile(scriptPath, 'utf8'));
    }

    let audioFiles: string[] = [];

    for (let i = 0; i < script.length; i++) {
        const line = script[i];
        const audioPath = paper.audioLocation(`${i.toString().padStart(5, '0')}-${line.voice}.wav`);
        if (!existsSync(audioPath)) {
            const voiceBuffer = line.voice === 'stefan' ? stefanVoiceBuffer : raduVoiceBuffer;
            console.log('Generating voice for text ...', `[${line.voice}]`, line.text);
            await generateVoice(line.text, voiceBuffer, audioPath);
        }
        audioFiles.push(audioPath);
    }

    const podcastPath = paper.podcastLocation();    
    console.log('Merging audio files ...', audioFiles, podcastPath);
    await mergeAudioFiles(audioFiles, podcastPath, 0.5);

    // Clear audio files after merge (default: true)
    if (clearAudioAfterMerge) {
        const audioFolder = path.join(paper.locationOnDisk(), 'audio');
        if (existsSync(audioFolder)) {
            console.log(`Clearing audio files from ${audioFolder}...`);
            await rm(audioFolder, { recursive: true });
        }
    }

    paper.setState('processedPodcast', true);
}
