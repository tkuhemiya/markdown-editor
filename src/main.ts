import { marked } from "marked"
import { debounce, decompressText, compressText } from "./utils";

const editor = document.getElementById("editor") as HTMLTextAreaElement;
const view = document.getElementById("view") as HTMLDivElement;

const urlHash = decodeURIComponent(location.hash.slice(1))

editor.value = await decompressText(urlHash);

editor.addEventListener("input", debounce(saveState, 1000));

async function saveState() {
  const compressed = await compressText(editor.value);
  updateView();
  console.log(compressed)
  location.hash = encodeURIComponent(compressed);
}

async function updateView() {
  view.innerHTML = await marked.parse(editor.value)

}
