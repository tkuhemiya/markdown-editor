import type { Note } from "./note";

export function toggleSidebar(): void {
  const sidebar = document.getElementById("sidebar")!;
  const main = document.querySelector("main")!;
  sidebar.classList.toggle("translate-x-0");
  main.classList.toggle("ml-[250px]");
}

export function showContextMenu(x: number, y: number, docId: number): void {
  const contextMenu = document.getElementById("context-menu");
  if (!contextMenu) return;

  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.dataset.docId = docId.toString();
  contextMenu.classList.remove("hidden");
}

export function hideContextMenu(): void {
  const contextMenu = document.getElementById("context-menu");
  if (!contextMenu) return;
  contextMenu.classList.add("hidden");
}

export function updateNoteList(
  notes: Note[],
  currentNoteId: number | null,
  onNoteClick?: (id: number) => void
): void {
  const noteList = document.getElementById("note-list");
  if (!noteList) return;

  noteList.innerHTML = "";

  notes.forEach((note) => {
    const li = document.createElement("li");
    const isCurrent = currentNoteId === note.id;

    li.className = `m-1 rounded-md p-2.5 border-b border-border cursor-pointer transition-colors duration-200 ease hover:bg-accent ${isCurrent
      ? "bg-primary text-primary-foreground hover:bg-primary"
      : ""
      }`;

    li.dataset.docId = note.id!.toString();

    const nameDiv = document.createElement("div");
    nameDiv.className = "font-medium mb-1 truncate";
    nameDiv.textContent = note.name;

    const dateDiv = document.createElement("div");
    dateDiv.className = "text-xs text-muted-foreground";
    dateDiv.textContent = new Date(note.updatedAt).toLocaleDateString();

    li.appendChild(nameDiv);
    li.appendChild(dateDiv);

    if (onNoteClick) {
      li.addEventListener("click", () => onNoteClick(note.id!));
    }

    noteList.appendChild(li);
  });
}
