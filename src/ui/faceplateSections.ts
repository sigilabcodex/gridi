export type FaceplateSectionKind = "io" | "feature" | "controls" | "secondary" | "bottom";

function addClasses(target: HTMLElement, classNames?: string) {
  if (!classNames) return;
  classNames
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .forEach((token) => target.classList.add(token));
}

export function createFaceplatePanel(className?: string) {
  const panel = document.createElement("div");
  panel.className = "surfaceTabPanel faceplatePanel module-face";
  addClasses(panel, className);
  return panel;
}

export function createFaceplateMainPanel() {
  const panel = createFaceplatePanel("surfaceMainLayout");
  panel.classList.add("faceplateMainPanel");
  return panel;
}

export function createFaceplateSection(kind: FaceplateSectionKind, className?: string) {
  const section = document.createElement("div");
  section.className = `faceplateSection face-section faceplateSection--${kind}`;
  if (kind === "bottom") section.classList.add("surfaceMainBottom", "face-bottom");
  addClasses(section, className);
  return section;
}

export function createFaceplateStackPanel(className?: string) {
  const panel = createFaceplatePanel(className);
  panel.classList.add("faceplateStackPanel");
  return panel;
}

export function createFaceplateSpacer(className?: string) {
  const spacer = document.createElement("div");
  spacer.className = "faceplateSpacer";
  addClasses(spacer, className);
  spacer.setAttribute("aria-hidden", "true");
  return spacer;
}
