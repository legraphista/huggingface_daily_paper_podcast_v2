import makeEta from 'simple-eta'

function formateEstimate(seconds: number) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.round(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    if (minutes > 0) {
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${remainingSeconds}s`;
}

export function tqdm<T>(iterable: Iterable<T> | T[], options?: { description?: string, total?: number }): Iterable<T> {
    const iterator = Array.isArray(iterable) ? iterable.values() : iterable[Symbol.iterator]();
    const count = options?.total || (Array.isArray(iterable) ? iterable.length : undefined);
    const description = options?.description || '';
    let current = 0;

    const eta = makeEta({
        max: count,
        autostart: true
    });

    return {
        [Symbol.iterator]() {
            return {
                next() {
                    const result = iterator.next();
                    if (!result.done) {
                        current++;
                        if (count) {
                            console.log(`${description} ${current}/${count} [${formateEstimate(eta.estimate())}]`);
                            eta.report(current);
                        } else {
                            console.log(`${description} ${current}/???`);
                        }
                    }
                    return result;
                }
            };
        }
    };
}
