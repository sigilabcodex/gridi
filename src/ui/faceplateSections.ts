export type FaceplateSectionKind = "io" | "feature" | "controls" | "secondary" | "bottom";

export function createFaceplatePanel(className?: string) {
  const panel = document.createElement("div");
  panel.className = "surfaceTabPanel faceplatePanel";
  if (className) panel.classList.add(className);
  return panel;
}

export function createFaceplateMainPanel() {
  const panel = createFaceplatePanel("surfaceMainLayout");
  panel.classList.add("faceplateMainPanel");
  return panel;
}

export function createFaceplateSection(kind: FaceplateSectionKind, className?: string) {
  const section = document.createElement("div");
  section.className = `faceplateSection faceplateSection--${kind}`;
  if (kind === "bottom") section.classList.add("surfaceMainBottom");
  if (className) section.classList.add(className);
  return section;
}

export function createFaceplateStackPanel(className?: string) {
  const panel = createFaceplatePanel(className);
  panel.classList.add("faceplateStackPanel");
  return panel;
}
