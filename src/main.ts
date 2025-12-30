
const editor = document.getElementById("editor") as HTMLTextAreaElement

const urlHash = decodeURIComponent(location.hash.slice(1))
editor.value = await decompressText(urlHash);

editor.addEventListener("input", debounce(saveState, 1000));

async function saveState() {
  const compressed = await compressText(editor.value);
  console.log(compressed)
  location.hash = encodeURIComponent(compressed);
}

function debounce(fn: Function, delay = 1000) {
  let timer: number;

  return function (...args: any) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn(args)
    }, delay)
  }
}

async function compressText(text: string): Promise<string> {
  return text;
}

async function decompressText(text: string): Promise<string> {
  return text;
}
