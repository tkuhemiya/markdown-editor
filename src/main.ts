import { marked } from "marked"
import { Editor, Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { keymap } from '@tiptap/pm/keymap'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { createLowlight, common } from 'lowlight'
import { debounce } from "./utils";
import { initDB } from "./db"
import { getLastOpenedDocument } from "./document"

// Auto-focus editor on page load
setTimeout(() => editor.commands.focus(), 100);

// Global state
let currentDocument: Document | null = null;
let hasUnsavedChanges = false;
let documentSaveStates = new Map<number, 'idle' | 'saving' | 'saved' | 'unsaved'>();

const lowlight = createLowlight(common)

// Initialize database and load last document
const DB = await initDB()
if (DB === null || DB == undefined) {
  throw Error("error initializing database")
}
currentDocument = await getLastOpenedDocument(DB);
const initialContent = currentDocument ? currentDocument.content : '';

const editor = new Editor({
  element: document.getElementById('editor'),
  extensions: [
    StarterKit.configure({
      codeBlock: false,
    }),
    CodeBlockLowlight.configure({
      lowlight,
    }),
    Markdown,
  ],
  content: initialContent,
  contentType: 'markdown',
  onUpdate: debounce(autoSave, 1000),
});


// Auto-save function
async function autoSave() {
  if (!currentDocument || !currentDocument.id || !hasUnsavedChanges) return;

  const docId = currentDocument.id;
  documentSaveStates.set(docId, 'saving');
  updateDocumentList();

  const markdown = editor.getMarkdown();
  currentDocument.content = markdown;
  currentDocument.updatedAt = new Date();

  try {
    await saveDocument(currentDocument);
    documentSaveStates.set(docId, 'saved');
    hasUnsavedChanges = false;
    updateDocumentList();

    // Reset to idle after 2 seconds
    setTimeout(() => {
      documentSaveStates.set(docId, 'idle');
      updateDocumentList();
    }, 2000);
  } catch (error) {
    documentSaveStates.set(docId, 'idle');
    console.error('Auto-save failed:', error);
    updateDocumentList();
  }
}

// Sidebar functionality
const sidebar = document.getElementById('sidebar')!;
const sidebarToggle = document.getElementById('sidebar-toggle')!;
const mainContent = document.querySelector('.main-content')!;
const newDocBtn = document.getElementById('new-doc')!;
const docList = document.getElementById('doc-list')!;

// Context menu
const contextMenu = document.getElementById('context-menu')!;

function toggleSidebar() {
  sidebar.classList.toggle('open');
  mainContent.classList.toggle('sidebar-open');

  if (window.innerWidth <= 768) {
    // Mobile: overlay mode
    if (sidebar.classList.contains('open')) {
      (mainContent as HTMLElement).style.display = 'none';
    } else {
      (mainContent as HTMLElement).style.display = '';
    }
  }
}

sidebarToggle.addEventListener('click', toggleSidebar);

newDocBtn.addEventListener('click', async () => {
  if (hasUnsavedChanges) {
    const shouldSave = await showUnsavedModal();
    if (shouldSave === null) return; // Cancelled
    if (shouldSave) {
      await saveCurrentDocument();
    }
  }

  const docName = await generateNextDocumentName();
  currentDocument = {
    name: docName,
    content: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastOpened: new Date(),
  };

  // Immediately save to get ID and make it appear in sidebar
  currentDocument.id = await saveDocument(currentDocument);
  documentSaveStates.set(currentDocument.id!, 'idle');

  editor.commands.clearContent();
  hasUnsavedChanges = false;
  updateDocumentList();
});

async function loadDocumentById(id: number) {
  if (hasUnsavedChanges) {
    const shouldSave = await showUnsavedModal();
    if (shouldSave === null) return; // Cancelled
    if (shouldSave) {
      await saveCurrentDocument();
    }
  }

  try {
    const doc = await loadDocument(id);
    if (doc) {
      currentDocument = doc;
      editor.commands.setContent(doc.content, { contentType: 'markdown', parseOptions: { preserveWhitespace: true } });
      hasUnsavedChanges = false;
      documentSaveStates.set(id, 'idle');
      updateDocumentList();
    }
  } catch (error) {
    console.error('Failed to load document:', error);
  }
}

async function updateDocumentList() {
  try {
    const docs = await listDocuments();
    docList.innerHTML = '';

    docs.forEach(doc => {
      const li = document.createElement('li');
      const state = documentSaveStates.get(doc.id!) || 'idle';
      const isCurrent = currentDocument?.id === doc.id;
      const hasChanges = hasUnsavedChanges && isCurrent;

      li.className = `doc-item ${isCurrent ? 'current' : ''} ${hasChanges ? 'unsaved' : ''} ${state}`;
      li.dataset.docId = doc.id!.toString();

      const nameDiv = document.createElement('div');
      nameDiv.className = 'doc-name';
      nameDiv.textContent = doc.name;

      const dateDiv = document.createElement('div');
      dateDiv.className = 'doc-date';
      dateDiv.textContent = new Date(doc.updatedAt).toLocaleDateString();

      li.appendChild(nameDiv);
      li.appendChild(dateDiv);
      li.addEventListener('click', () => loadDocumentById(doc.id!));

      docList.appendChild(li);
    });
  } catch (error) {
    console.error('Failed to load document list:', error);
  }
}

// Modal functionality
const unsavedModal = document.getElementById('unsaved-modal')!;
const saveBtn = document.getElementById('save-changes')!;
const discardBtn = document.getElementById('discard-changes')!;
const cancelBtn = document.getElementById('cancel-action')!;

function showUnsavedModal(): Promise<boolean | null> {
  return new Promise((resolve) => {
    unsavedModal.classList.remove('hidden');

    const cleanup = () => {
      unsavedModal.classList.add('hidden');
      saveBtn.removeEventListener('click', onSave);
      discardBtn.removeEventListener('click', onDiscard);
      cancelBtn.removeEventListener('click', onCancel);
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

    saveBtn.addEventListener('click', onSave);
    discardBtn.addEventListener('click', onDiscard);
    cancelBtn.addEventListener('click', onCancel);
  });
}

async function saveCurrentDocument() {
  if (!currentDocument) return;

  const name = prompt('Enter document name:', currentDocument.name);
  if (!name) return;

  currentDocument.name = name;
  currentDocument.updatedAt = new Date();

  try {
    currentDocument.id = await saveDocument(currentDocument);
    hasUnsavedChanges = false;
    updateDocumentList();
  } catch (error) {
    console.error('Failed to save document:', error);
  }
}

// Track changes
editor.on('update', () => {
  hasUnsavedChanges = true;
});

// Paste handling
editor.on('paste', ({ editor: tipTapEditor, event }) => {
  const pastedText = event.clipboardData?.getData('text/plain');
  if (pastedText) {
    const html = marked.parse(pastedText);
    tipTapEditor.commands.insertContent(html);
    event.preventDefault();
  }
});

// Auto-focus on window focus
window.addEventListener('focus', () => {
  setTimeout(() => editor.commands.focus(), 50);
});

// Context menu functions
function showContextMenu(x: number, y: number, docId: number) {
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.dataset.docId = docId.toString();
  contextMenu.classList.remove('hidden');
}

function hideContextMenu() {
  contextMenu.classList.add('hidden');
}

// Context menu event listeners
docList.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const item = (e.target as Element).closest('.doc-item') as HTMLElement;
  if (!item) return;

  const docId = parseInt(item.dataset.docId!);
  showContextMenu(e.clientX, e.clientY, docId);
});

contextMenu.addEventListener('click', async (e) => {
  const target = e.target as HTMLElement;
  const action = target.dataset.action;
  const docId = parseInt(contextMenu.dataset.docId!);

  if (!action || !docId) return;

  switch (action) {
    case 'rename':
      await renameDocument(docId);
      break;
    case 'copy':
      await copyDocumentContent(docId);
      break;
    case 'delete':
      await deleteDocumentHandler(docId);
      break;
  }

  hideContextMenu();
});

document.addEventListener('click', (e) => {
  if (!contextMenu.contains(e.target as Node)) {
    hideContextMenu();
  }
});

// Context menu action functions
async function renameDocument(id: number) {
  try {
    const doc = await loadDocument(id);
    if (!doc) return;

    const newName = prompt('Enter new name:', doc.name);
    if (newName && newName.trim() !== '' && newName !== doc.name) {
      const trimmedName = newName.trim();

      // Check for conflicts
      const docs = await listDocuments();
      if (docs.some(d => d.name === trimmedName && d.id !== id)) {
        alert('A document with this name already exists. Please choose a different name.');
        return;
      }

      doc.name = trimmedName;
      await saveDocument(doc);
      updateDocumentList();
    }
  } catch (error) {
    console.error('Failed to rename document:', error);
  }
}

async function copyDocumentContent(id: number) {
  try {
    const doc = await loadDocument(id);
    if (!doc) return;

    await navigator.clipboard.writeText(doc.content);
    // Could add a toast notification here
    console.log('Content copied to clipboard');
  } catch (error) {
    console.error('Failed to copy content:', error);
    // Fallback for older browsers
    try {
      const doc = await loadDocument(id);
      if (!doc) return;

      const textArea = document.createElement('textarea');
      textArea.value = doc.content;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      console.log('Content copied to clipboard (fallback)');
    } catch (fallbackError) {
      console.error('Fallback copy also failed:', fallbackError);
    }
  }
}

async function deleteDocumentHandler(id: number) {
  try {
    await deleteDoc(id);

    if (currentDocument?.id === id) {
      currentDocument = null;
      editor.commands.clearContent();
      hasUnsavedChanges = false;
    }

    updateDocumentList();
  } catch (error) {
    console.error('Failed to delete document:', error);
  }
}

// Name generation with conflict handling
async function generateNextDocumentName(): Promise<string> {
  const docs = await listDocuments();
  const existingNames = docs.map(d => d.name);

  let counter = 1;
  let candidate = `Document ${counter}`;

  while (existingNames.includes(candidate)) {
    counter++;
    candidate = `Document ${counter}`;
  }

  // Double-check for race conditions
  const refreshedDocs = await listDocuments();
  const refreshedNames = refreshedDocs.map(d => d.name);

  if (refreshedNames.includes(candidate)) {
    const newName = prompt('Naming conflict occurred. Please enter a different name:', candidate);
    return newName && newName.trim() !== '' ? newName.trim() : `Document ${Date.now()}`;
  }

  return candidate;
}

// Initialize
updateDocumentList();
