export function debounce(fn: Function, delay = 1000) {
  let timer: number;

  return function (...args: any) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn(args)
    }, delay)
  }
}

export async function compressText(text: string): Promise<string> {
  return text;
}

export async function decompressText(text: string): Promise<string> {
  return text;
}
