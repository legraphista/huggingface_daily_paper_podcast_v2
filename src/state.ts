import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";


// YYYY-MM-DD
export type PaperDate = `${number}-${number}-${number}`;
export function dateToPaperDate(date: Date): PaperDate {
    return date.toISOString().split('T')[0] as PaperDate;
}

export type PaperData = {
    id: string;
    date: PaperDate;
    title: string;
    url: string;
    pdfUrl: string;
    abstract?: string;
    cancelled?: boolean;
};


export type PaperState = Partial<{
    downloadedPDF: boolean;
    processedPodcast: boolean;
    publishedToSpotify: boolean;
}>

export type State = {
    papers: {
        [id: string]: PaperData;
    }
    paper_states: {
        [id: string]: PaperState;
    }
};

const STATE_FILE = 'data/state.json';

export class StateData {
    private load(): State {
        const data = readFileSync(STATE_FILE, 'utf8');
        return JSON.parse(data);
    }

    private save(state: State) {
        writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    }

    private update(updater: (state: State) => void) {
        const state = this.load();
        updater(state);
        this.save(state);
    }

    getPaper(id: string) {
        const state = this.load();
        const paperData = state.papers[id];
        if (!paperData) return undefined;
        return new Paper(paperData);
    }

    setPaper(id: string, paper: PaperData | Paper) {
        this.update(state => {
            state.papers[id] = paper instanceof Paper ? paper.paper : paper;
        });
    }

    setPaperState(id: string, key: keyof State['paper_states'][string], value: State['paper_states'][string][typeof key]) {
        this.update(state => {
            state.paper_states[id] ??= {};
            state.paper_states[id][key] = value;
        });
    }

    getPaperState(id: string, key: keyof State['paper_states'][string]) {
        const state = this.load();
        return state.paper_states[id]?.[key];
    }

    listByState(predicate: (paperState: PaperState) => boolean): Paper[] {
        const state = this.load();
        return Object
            .entries(state.paper_states)
            .filter(([id, paperState]) => predicate(paperState))
            .map(([id]) => {
                const paperData = state.papers[id];
                if (!paperData) return undefined;
                return new Paper(paperData);
            })
            .filter((paper): paper is Paper => !!paper);
    }

    findByState(predicate: (paperState: PaperState) => boolean): Paper | undefined {
        return this.listByState(predicate)[0];
    }
}

export const state = new StateData();

export class Paper {
    get id() {
        return this.paper.id;
    }

    constructor(readonly paper: PaperData) {
        mkdirSync(path.join('data', paper.id), { recursive: true });
    }

    static fromId(id: string) {
        return state.getPaper(id);
    }

    setState<K extends keyof State['paper_states'][string], V extends State['paper_states'][string][K]>(key: K, value: V) {
        state.setPaperState(this.paper.id, key, value);
    }

    getState(key: keyof State['paper_states'][string]) {
        return state.getPaperState(this.paper.id, key);
    }

    locationOnDisk() {
        return path.resolve(path.join('data', this.paper.id));
    }

    pdfLocation() {
        return path.resolve(path.join(this.locationOnDisk(), `paper.pdf`));
    }

    audioLocation(fileName: string) {
        const audioFolder = path.join(this.locationOnDisk(), `audio`);
        mkdirSync(audioFolder, { recursive: true });
        return path.resolve(path.join(audioFolder, fileName));
    }

    podcastLocation() {
        return path.resolve(path.join(this.locationOnDisk(), `podcast.mp3`));
    }

    scriptLocation() {
        return path.resolve(path.join(this.locationOnDisk(), `script.json`));
    }
}