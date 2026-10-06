type KeyboardViewport = {
  narrow: boolean;
  editing: boolean;
  layoutHeight: number;
  visibleHeight: number;
  scale: number;
};

export function isSoftwareKeyboardOpen({ narrow, editing, layoutHeight, visibleHeight, scale }: KeyboardViewport) {
  // Normalize pinch zoom; browser toolbars alone should not hide navigation.
  return narrow && editing && layoutHeight - visibleHeight * scale > 120;
}
