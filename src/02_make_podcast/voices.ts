import { Client } from "@gradio/client";
import assert from "assert";
import { readFileSync } from "fs";
import { rename } from "fs/promises";

export const stefanVoiceBuffer = readFileSync('./assets/voices/stefan.mp3');
// export const raduVoiceBuffer = readFileSync('./assets/voices/radu.ogg');
export const raduVoiceBuffer = readFileSync('./assets/voices/celebratedcrimesv1_13_dumas_0154.flac');

export async function generateVoice(text: string, voiceBuffer: Buffer, outputPath: string) {
    const client = await Client.connect("http://127.0.0.1:13377/");
    const result = await client.predict("/generate", {
        text,
        audio_prompt_path: voiceBuffer,
        temperature: 0.9,
        seed_num: 24,
        min_p: 0,
        top_p: 0.95,
        top_k: 1000,
        repetition_penalty: 1.2,
        norm_loudness: true,
    });



    const file = (result.data as any)[0];
    assert(file, 'File is required in the result');
    assert(file.path, 'File path is required in the result');
    const filePath = file.path;
    rename(filePath, outputPath);
    
    return file;
}