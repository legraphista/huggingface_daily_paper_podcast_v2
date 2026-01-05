import { spawn, execSync } from "child_process";
import path from "path";

const ASSETS_DIR = path.join(import.meta.dirname, '../../assets');
const INTRO_PATH = path.join(ASSETS_DIR, 'jingles/intro.wav');
const OUTRO_PATH = path.join(ASSETS_DIR, 'jingles/outro.wav');

// Intro: 20s total, play solo for 10s, overlap with voices for 10s
const INTRO_SOLO_TIME = 10;
// Outro: 17s total, overlap with voices for 7s, then solo for 10s
const OUTRO_OVERLAP_TIME = 7;

// Build atempo filter chain for speeds outside 0.5-2.0 range
function buildAtempoFilter(speed: number): string {
    if (speed === 1) return '';
    const filters: string[] = [];
    let remaining = speed;
    while (remaining > 2.0) {
        filters.push('atempo=2.0');
        remaining /= 2.0;
    }
    while (remaining < 0.5) {
        filters.push('atempo=0.5');
        remaining /= 0.5;
    }
    filters.push(`atempo=${remaining}`);
    return filters.join(',');
}

function getAudioDuration(filePath: string): number {
    const result = execSync(
        `ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`,
        { encoding: 'utf-8' }
    );
    return parseFloat(result.trim());
}

function runFfmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const proc = spawn('ffmpeg', args, {
            stdio: ['ignore', 'inherit', 'inherit']
        });
        proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`ffmpeg exited with code ${code}`));
        });
        proc.on('error', reject);
    });
}

export async function mergeAudioFiles(
    audioFiles: string[],
    outputPath: string,
    silenceGap = 0.5,
    speed = 1.25
) {
    console.log('Merging audio files ...', audioFiles.length, 'files');

    // First pass: merge voice files to a temp file to get duration
    const tempVoicesPath = outputPath.replace(/\.[^.]+$/, '_voices_temp.wav');
    await mergeVoiceFiles(audioFiles, tempVoicesPath, silenceGap, speed);

    // Get the duration of merged voices
    const voicesDuration = getAudioDuration(tempVoicesPath);
    console.log('Voices duration:', voicesDuration, 'seconds');

    // Calculate outro delay: voices start at INTRO_SOLO_TIME, outro starts OUTRO_OVERLAP_TIME before voices end
    const outroDelay = INTRO_SOLO_TIME + voicesDuration - OUTRO_OVERLAP_TIME;
    const outroDelayMs = Math.round(outroDelay * 1000);
    const introSoloMs = INTRO_SOLO_TIME * 1000;

    // Build final mix with intro and outro
    // Input 0: intro, Input 1: outro, Input 2: voices
    const filterComplex = [
        // Delay voices to start after intro solo time
        `[2:a]adelay=${introSoloMs}|${introSoloMs}[voices_delayed]`,
        // Delay outro to overlap with end of voices
        `[1:a]adelay=${outroDelayMs}|${outroDelayMs}[outro_delayed]`,
        // Mix all three: intro + delayed voices + delayed outro
        `[0:a][voices_delayed][outro_delayed]amix=inputs=3:duration=longest:normalize=0[mixed]`,
        // EBU R128 loudness normalization (podcast standard: -16 LUFS)
        `[mixed]loudnorm=I=-16:TP=-1.5:LRA=11[out]`
    ].join(';');

    const args = [
        '-i', INTRO_PATH,
        '-i', OUTRO_PATH,
        '-i', tempVoicesPath,
        '-filter_complex', filterComplex,
        '-map', '[out]',
        // Best quality MP3 encoding
        '-c:a', 'libmp3lame',
        '-b:a', '320k',
        '-y',
        outputPath
    ];

    await runFfmpeg(args);

    // Clean up temp file
    const { unlink } = await import('fs/promises');
    await unlink(tempVoicesPath).catch(() => {});

    console.log('Podcast generated:', outputPath);
}

// Pan filters for stereo positioning (even=left, odd=right)
const PAN_LEFT = 'pan=stereo|c0=c0|c1=0.85*c0';   // full left, 70% right
const PAN_RIGHT = 'pan=stereo|c0=0.85*c0|c1=c0';  // 70% left, full right

async function mergeVoiceFiles(
    audioFiles: string[],
    outputPath: string,
    silenceGap: number,
    speed: number
) {
    const inputs = audioFiles.flatMap(file => ['-i', file]);
    const tempoFilter = buildAtempoFilter(speed);
    const tempoSuffix = tempoFilter ? `[merged];[merged]${tempoFilter}[out]` : '[out]';

    let filterComplex: string;
    let args: string[];

    // Apply panning to each voice: even indices left, odd indices right
    const panFilters = audioFiles.map((_, i) => {
        const inputIdx = silenceGap > 0 && audioFiles.length > 1 ? i + 1 : i;
        const pan = i % 2 === 0 ? PAN_LEFT : PAN_RIGHT;
        return `[${inputIdx}:a]${pan}[v${i}]`;
    }).join(';');

    if (silenceGap > 0 && audioFiles.length > 1) {
        const numGaps = audioFiles.length - 1;
        const silenceSplits = Array.from({ length: numGaps }, (_, i) => `[s${i}]`).join('');
        // Stereo silence to match panned voices
        const silenceGen = numGaps === 1
            ? `anullsrc=r=44100:cl=stereo,atrim=0:${silenceGap}[s0];`
            : `anullsrc=r=44100:cl=stereo,atrim=0:${silenceGap},asplit=${numGaps}${silenceSplits};`;

        // Interleave panned voices with silence gaps
        const segments = audioFiles.flatMap((_, i) =>
            i < numGaps ? [`[v${i}]`, `[s${i}]`] : [`[v${i}]`]
        ).join('');
        const totalSegments = audioFiles.length + numGaps;

        filterComplex = `${panFilters};${silenceGen}${segments}concat=n=${totalSegments}:v=0:a=1${tempoSuffix}`;
        args = [
            '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
            ...inputs,
            '-filter_complex', filterComplex,
            '-map', '[out]',
            '-y',
            outputPath
        ];
    } else {
        const segments = audioFiles.map((_, i) => `[v${i}]`).join('');
        filterComplex = `${panFilters};${segments}concat=n=${audioFiles.length}:v=0:a=1${tempoSuffix}`;
        args = [
            ...inputs,
            '-filter_complex', filterComplex,
            '-map', '[out]',
            '-y',
            outputPath
        ];
    }

    await runFfmpeg(args);
}