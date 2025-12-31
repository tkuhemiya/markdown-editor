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

// Auto-focus editor on page load
setTimeout(() => editor.commands.focus(), 100);

// Global state
let currentNote: Note | null = null;
let hasUnsavedChanges = false;
let noteSaveStates = new Map<number, "idle" | "saving" | "saved" | "unsaved">();

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
      console.log("focus");
      editor.commands.focus("end");
    }, 10);
  },
});

// Auto-save function
async function autoSave() {
  if (!currentNote || !currentNote.id || !hasUnsavedChanges) return;
  console.log("saving")

  const docId = currentNote.id;
  noteSaveStates.set(docId, "saving");
  // updateNoteList();

  const markdown = editor.getMarkdown();
  currentNote.content = markdown;
  currentNote.updatedAt = new Date();

  try {
    await saveNote(db, currentNote);
    noteSaveStates.set(docId, "saved");
    hasUnsavedChanges = false;
    updateNoteList();

    // Reset to idle after 2 seconds
    setTimeout(() => {
      noteSaveStates.set(docId, "idle");
      updateNoteList();
    }, 2000);
  } catch (error) {
    noteSaveStates.set(docId, "idle");
    console.error("Auto-save failed:", error);
    updateNoteList();
  }
}

// Sidebar functionality
const sidebar = document.getElementById("sidebar")!;
const sidebarToggle = document.getElementById("sidebar-toggle")!;
const newDocBtn = document.getElementById("new-note")!;
const noteList = document.getElementById("note-list")!;
// Context menu
const contextMenu = document.getElementById("context-menu")!;

function toggleSidebar() {
  sidebar.classList.toggle("translate-x-0");
}

sidebarToggle.addEventListener("click", toggleSidebar);

newDocBtn.addEventListener("click", async () => {
  if (hasUnsavedChanges) {
    const shouldSave = await showUnsavedModal();
    if (shouldSave === null) return; // Cancelled
    if (shouldSave) {
      await saveCurrentDocument();
    }
  }

  const docName = await generateNextNoteName();
  currentNote = {
    name: docName,
    content: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Immediately save to get ID and make it appear in sidebar
  currentNote.id = await saveNote(db, currentNote);
  noteSaveStates.set(currentNote.id!, "idle");

  editor.commands.clearContent();
  hasUnsavedChanges = false;
  updateNoteList();
});

async function loadNoteById(id: number) {
  if (hasUnsavedChanges) {
    const shouldSave = await showUnsavedModal();
    if (shouldSave === null) return; // Cancelled
    if (shouldSave) {
      await saveCurrentDocument();
    }
  }

  try {
    const doc = await loadNote(db, id);
    if (doc) {
      currentNote = doc;
      editor.commands.setContent(doc.content, {
        contentType: "markdown",
        parseOptions: { preserveWhitespace: true },
      });
      hasUnsavedChanges = false;
      noteSaveStates.set(id, "idle");
      updateNoteList();
    }
  } catch (error) {
    console.error("Failed to load document:", error);
  }
}

async function updateNoteList() {
  try {
    const docs = await listNotes(db);
    noteList.innerHTML = "";

    docs.forEach((doc) => {
      const li = document.createElement("li");
      const state = noteSaveStates.get(doc.id!) || "idle";
      const isCurrent = currentNote?.id === doc.id;
      const hasChanges = hasUnsavedChanges && isCurrent;

      li.className = `m-1 rounded-md p-2.5 border-b border-border cursor-pointer transition-colors duration-200 ease hover:bg-accent ${isCurrent ? "bg-primary text-primary-foreground" : ""} ${hasChanges ? "italic" : ""} ${state}`;
      li.dataset.docId = doc.id!.toString();

      const nameDiv = document.createElement("div");
      nameDiv.className = "font-medium mb-1";
      nameDiv.textContent = doc.name;

      const dateDiv = document.createElement("div");
      dateDiv.className = "text-xs text-muted-foreground";
      dateDiv.textContent = new Date(doc.updatedAt).toLocaleDateString();

      li.appendChild(nameDiv);
      li.appendChild(dateDiv);
      li.addEventListener("click", () => loadNoteById(doc.id!));

      noteList.appendChild(li);
    });
  } catch (error) {
    console.error("Failed to load document list:", error);
  }
}

// Modal functionality
const unsavedModal = document.getElementById("unsaved-modal")!;
const saveBtn = document.getElementById("save-changes")!;
const discardBtn = document.getElementById("discard-changes")!;
const cancelBtn = document.getElementById("cancel-action")!;

function showUnsavedModal(): Promise<boolean | null> {
  return new Promise((resolve) => {
    unsavedModal.classList.remove("hidden");

    const cleanup = () => {
      unsavedModal.classList.add("hidden");
      saveBtn.removeEventListener("click", onSave);
      discardBtn.removeEventListener("click", onDiscard);
      cancelBtn.removeEventListener("click", onCancel);
    };

    const onSave = () => {
      cleanup();
      resolve(true);
    };

    const onDiscard = () => {
      cleanup();
      resolve(false);
    };

    const onCancel = () => {
      cleanup();
      resolve(null);
    };

    saveBtn.addEventListener("click", onSave);
    discardBtn.addEventListener("click", onDiscard);
    cancelBtn.addEventListener("click", onCancel);
  });
}

async function saveCurrentDocument() {
  if (!currentNote) return;

  const name = prompt("Enter note name:", currentNote.name);
  if (!name) return;

  currentNote.name = name;
  currentNote.updatedAt = new Date();

  try {
    currentNote.id = await saveNote(db, currentNote);
    hasUnsavedChanges = false;
    updateNoteList();
  } catch (error) {
    console.error("Failed to save document:", error);
  }
}

// Track changes
editor.on("update", () => {
  hasUnsavedChanges = true;
});

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

// Context menu functions
function showContextMenu(x: number, y: number, docId: number) {
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.dataset.docId = docId.toString();
  contextMenu.classList.remove("hidden");
}

function hideContextMenu() {
  contextMenu.classList.add("hidden");
}

// Context menu event listeners
noteList.addEventListener("contextmenu", (e) => {
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

// Context menu action functions
async function renameNote(id: number) {
  try {
    const doc = await loadNote(db, id);
    if (!doc) return;

    const newName = prompt("Enter new note name:", doc.name);
    if (newName && newName.trim() !== "" && newName !== doc.name) {
      const trimmedName = newName.trim();

      // Check for conflicts
      const docs = await listNotes(db);
      if (docs.some((d) => d.name === trimmedName && d.id !== id)) {
        alert(
          "A note with this name already exists. Please choose a different name.",
        );
        return;
      }

      doc.name = trimmedName;
      await saveNote(db, doc);
      updateNoteList();
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
    // Could add a toast notification here
    console.log("Content copied to clipboard");
  } catch (error) {
    console.error("Failed to copy content:", error);
    // Fallback for older browsers
    try {
      const doc = await loadNote(db, id);
      if (!doc) return;

      const textArea = document.createElement("textarea");
      textArea.value = doc.content;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      console.log("Content copied to clipboard (fallback)");
    } catch (fallbackError) {
      console.error("Fallback copy also failed:", fallbackError);
    }
  }
}

async function deleteNoteHandler(id: number) {
  try {
    await deleteNote(db, id);

    if (currentNote?.id === id) {
      currentNote = null;
      editor.commands.clearContent();
      hasUnsavedChanges = false;
    }

    updateNoteList();
  } catch (error) {
    console.error("Failed to delete document:", error);
  }
}

// Name generation for conflict handling
async function generateNextNoteName(): Promise<string> {
  const docs = await listNotes(db);
  const existingNames = docs.map((d) => d.name);

  let counter = 1;
  let candidate = `Document ${counter}`;

  while (existingNames.includes(candidate)) {
    counter++;
    candidate = `Note ${counter}`;
  }

  // Double-check for race conditions
  const refreshedDocs = await listNotes(db);
  const refreshedNames = refreshedDocs.map((d) => d.name);

  if (refreshedNames.includes(candidate)) {
    const newName = prompt(
      "Naming conflict occurred. Please enter a different note name:",
      candidate,
    );
    return newName && newName.trim() !== ""
      ? newName.trim()
      : `Note ${Date.now()}`;
  }

  return candidate;
}

// Initialize
updateNoteList();
