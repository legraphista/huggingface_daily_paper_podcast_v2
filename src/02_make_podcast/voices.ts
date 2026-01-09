import { Client } from "@gradio/client";
import assert from "assert";
import { readFileSync } from "fs";
import { rename } from "fs/promises";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceFolder = path.resolve(__dirname, "../..");

export const stefanVoiceBuffer = readFileSync('./assets/voices/stefan.mp3');
export const raduVoiceBuffer = readFileSync('./assets/voices/celebratedcrimesv1_13_dumas_0154.flac');

export class ChatterboxTurbo {
    private process: ChildProcess | null = null;
    private client: typeof Client.prototype | null = null;
    private readonly serverUrl = "http://127.0.0.1:13377/";

    async start(): Promise<void> {
        return new Promise((resolve, reject) => {
            const chatterboxDir = path.join(workspaceFolder, "chatterbox-turbo-demo");
            const pythonPath = path.join(chatterboxDir, ".venv", "bin", "python");
            const appPath = path.join(chatterboxDir, "app.py");

            console.log("Starting Chatterbox Turbo Demo...");
            console.log(`Python: ${pythonPath}`);
            console.log(`App: ${appPath}`);
            console.log(`CWD: ${chatterboxDir}`);

            this.process = spawn(pythonPath, ["-u", appPath], {
                cwd: chatterboxDir,
                env: {
                    ...process.env,
                    VIRTUAL_ENV: path.join(chatterboxDir, ".venv"),
                    PATH: `${path.join(chatterboxDir, ".venv", "bin")}:${process.env.PATH}`,
                    CUDA_VISIBLE_DEVICES: "0",
                    PYTHONUNBUFFERED: "1",
                },
                stdio: ["ignore", "pipe", "pipe"],
            });

            let resolved = false;
            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    reject(new Error("Timeout waiting for Chatterbox Turbo to start (60s)"));
                }
            }, 120000);

            this.process.stdout?.on("data", (data: Buffer) => {
                const output = data.toString();
                process.stdout.write(`[Chatterbox] ${output}`);
                if (!resolved && output.includes("Running on local URL")) {
                    resolved = true;
                    clearTimeout(timeout);
                    console.log("\n✓ Chatterbox Turbo Demo is ready!\n");
                    resolve();
                }
            });

            this.process.stderr?.on("data", (data: Buffer) => {
                const output = data.toString();
                process.stderr.write(`[Chatterbox] ${output}`);
                // Gradio sometimes prints the URL to stderr
                if (!resolved && output.includes("Running on local URL")) {
                    resolved = true;
                    clearTimeout(timeout);
                    console.log("\n✓ Chatterbox Turbo Demo is ready!\n");
                    resolve();
                }
            });

            this.process.on("error", (err) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    reject(new Error(`Failed to start Chatterbox Turbo: ${err.message}`));
                }
            });

            this.process.on("exit", (code, signal) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    reject(new Error(`Chatterbox Turbo exited unexpectedly with code ${code}, signal ${signal}`));
                }
            });
        });
    }

    stop(): void {
        if (this.process) {
            console.log("\nStopping Chatterbox Turbo Demo...");
            this.process.kill("SIGTERM");

            // Force kill after 5 seconds if it doesn't stop gracefully
            const proc = this.process;
            setTimeout(() => {
                if (proc && !proc.killed) {
                    console.log("Force killing Chatterbox Turbo Demo...");
                    proc.kill("SIGKILL");
                }
            }, 5000);

            this.process = null;
            this.client = null;
            console.log("✓ Chatterbox Turbo Demo stopped.\n");
        }
    }

    async generateVoice(text: string, voiceBuffer: Buffer, outputPath: string): Promise<void> {
        const client = await Client.connect(this.serverUrl);
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
        await rename(file.path, outputPath);
    }
}
