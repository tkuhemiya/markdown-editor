import { marked } from "marked"
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { CodeBlock } from '@tiptap/extension-code-block'
import hljs from 'highlight.js'
import { debounce, decompressText, compressText } from "./utils";

const CustomCodeBlock = CodeBlock.extend({
  renderHTML({ node }) {
    const code = node.textContent
    const highlighted = hljs.highlightAuto(code).value
    return ['pre', ['code', { class: 'hljs' }, highlighted]]
  },
})

const urlHash = decodeURIComponent(location.hash.slice(1))
const initialContent = await decompressText(urlHash);

const editor = new Editor({
  element: document.getElementById('editor'),
  extensions: [
    StarterKit.configure({
      codeBlock: false,
    }),
    CustomCodeBlock,
    Markdown,
  ],
  content: initialContent,
  contentType: 'markdown',
  onUpdate: debounce(saveState, 1000),
});

// Auto-focus editor on page load
setTimeout(() => editor.commands.focus(), 100);

editor.on('paste', ({ editor: tipTapEditor, event }) => {
  const pastedText = event.clipboardData?.getData('text/plain');
  if (pastedText) {
    const html = marked.parse(pastedText);
    tipTapEditor.commands.insertContent(html);
    event.preventDefault();
  }
});

// Auto-focus editor when window gains focus
window.addEventListener('focus', () => {
  setTimeout(() => editor.commands.focus(), 50);
});

async function saveState() {
  const markdown = editor.getMarkdown();
  const compressed = await compressText(markdown);
  console.log(compressed);
  location.hash = encodeURIComponent(compressed);
}
