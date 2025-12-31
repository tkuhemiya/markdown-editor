import { marked } from "marked";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight, common } from "lowlight";
import { debounce } from "./utils";
import { initDB } from "./db";
import type { Note } from "./note";
import {
  getLastUpdatedNote,
  saveNote,
  loadNote,
  listNotes,
  deleteNote,
} from "./note";
import {
  toggleSidebar,
  showContextMenu,
  hideContextMenu,
  updateNoteList,
} from "./ui";

let currentNote: Note | null = null;

// Initialize database and load last document
const db = (await initDB()) as IDBDatabase;
if (db === null || db == undefined) {
  console.error("couldn't initializing database");
}
currentNote = await getLastUpdatedNote(db);

const lowlight = createLowlight(common);

const editor = new Editor({
  element: document.getElementById("editor"),
  extensions: [
    StarterKit.configure({
      codeBlock: false,
    }),
    CodeBlockLowlight.configure({
      lowlight,
    }),
    Markdown,
  ],
  content: currentNote ? currentNote.content : "",
  contentType: "markdown",
  onUpdate: debounce(autoSave, 1000),
  onBlur({ editor }) {
    setTimeout(() => {
      editor.commands.focus("end");
    }, 10);
  },
});

// Auto-focus editor on page load
setTimeout(() => editor.commands.focus(), 100);

// Auto-save function
async function autoSave() {
  if (!currentNote || !currentNote.id) return;

  const markdown = editor.getMarkdown();
  currentNote.content = markdown;
  currentNote.updatedAt = new Date();

  try {
    await saveNote(db, currentNote);
    await refreshNoteList();
  } catch (error) {
    console.error("Auto-save failed:", error);
  }
}

// Save current document before switching
async function saveCurrentDocument() {
  if (!currentNote) return;

  const markdown = editor.getMarkdown();
  currentNote.content = markdown;
  currentNote.updatedAt = new Date();

  try {
    await saveNote(db, currentNote);
  } catch (error) {
    console.error("Failed to save document:", error);
  }
}

async function refreshNoteList() {
  const notes = await listNotes(db);
  updateNoteList(notes, currentNote?.id || null, loadNoteById);
}

// Sidebar functionality
const sidebarToggle = document.getElementById("sidebar-toggle")!;
const newDocBtn = document.getElementById("new-note")!;
const contextMenu = document.getElementById("context-menu")!;

sidebarToggle.addEventListener("click", toggleSidebar);

newDocBtn.addEventListener("click", async () => {
  // Save current document before creating new one
  await saveCurrentDocument();

  const docName = prompt("Enter Name");
  if (!docName) return; // User cancelled

  currentNote = {
    name: docName,
    content: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Save to get ID and make it appear in sidebar
  currentNote.id = await saveNote(db, currentNote);

  editor.commands.clearContent();
  await refreshNoteList();
});

async function loadNoteById(id: number) {
  // Save current document before switching
  await saveCurrentDocument();

  try {
    const doc = await loadNote(db, id);
    if (doc) {
      currentNote = doc;
      editor.commands.setContent(doc.content, {
        contentType: "markdown",
        parseOptions: { preserveWhitespace: true },
      });
      await refreshNoteList();
    }
  } catch (error) {
    console.error("Failed to load document:", error);
  }
}

// Paste handling
editor.on("paste", ({ editor: tipTapEditor, event }) => {
  const pastedText = event.clipboardData?.getData("text/plain");
  if (pastedText) {
    const html = marked.parse(pastedText);
    tipTapEditor.commands.insertContent(html);
    event.preventDefault();
  }
});

// Auto-focus on window focus
window.addEventListener("focus", () => {
  setTimeout(() => editor.commands.focus(), 50);
});

// Context menu event listeners
document.addEventListener("contextmenu", (e) => {
  const noteList = document.getElementById("note-list");
  if (!noteList || !noteList.contains(e.target as Node)) return;

  e.preventDefault();
  const item = (e.target as Element).closest('[class*="p-2.5"]') as HTMLElement;
  if (!item) return;

  const docId = parseInt(item.dataset.docId!);
  showContextMenu(e.clientX, e.clientY, docId);
});

contextMenu.addEventListener("click", async (e) => {
  const target = e.target as HTMLElement;
  const action = target.dataset.action;
  const docId = parseInt(contextMenu.dataset.docId!);

  if (!action || !docId) return;

  switch (action) {
    case "rename":
      console.log("rename")
      await renameNote(docId);
      break;
    case "copy":
      await copyNoteContent(docId);
      break;
    case "delete":
      await deleteNoteHandler(docId);
      break;
  }

  hideContextMenu();
});

document.addEventListener("click", (e) => {
  if (!contextMenu.contains(e.target as Node)) {
    hideContextMenu();
  }
});

async function renameNote(id: number) {
  try {
    const doc = await loadNote(db, id);
    if (!doc) return;

    const newName = prompt("Enter New Name");
    if (newName && newName !== doc.name) {
      // Check for conflicts
      const docs = await listNotes(db);
      if (docs.some((d) => d.name === newName && d.id !== id)) {
        alert(
          "A note with this name already exists. Please choose a different name.",
        );
        return;
      }

      doc.name = newName;
      await saveNote(db, doc);

      // Update currentNote if it's the one being renamed
      if (currentNote?.id === id) {
        currentNote.name = newName;
      }

      await refreshNoteList();
    }
  } catch (error) {
    console.error("Failed to rename document:", error);
  }
}

async function copyNoteContent(id: number) {
  try {
    const doc = await loadNote(db, id);
    if (!doc) return;

    await navigator.clipboard.writeText(doc.content);
    console.log("Content copied to clipboard");
  } catch (error) {
    console.error("Failed to copy content:", error);
  }
}

async function deleteNoteHandler(id: number) {
  try {
    await deleteNote(db, id);

    if (currentNote?.id === id) {
      currentNote = null;
      editor.commands.clearContent();
    }

    await refreshNoteList();
  } catch (error) {
    console.error("Failed to delete document:", error);
  }
}

// Initialize
const initializeApp = async () => {
  await refreshNoteList();
};
initializeApp();
