export function isEditableShortcutTarget(target: { tagName?: string; isContentEditable?: boolean } | null) {
  const tag = target?.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || !!target?.isContentEditable;
}
