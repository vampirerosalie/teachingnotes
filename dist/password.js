// Keep a native password input for autofill/accessibility, but never paint its glyphs:
// Safari may briefly reveal the last typed character even on type=password inputs.
export function maskPassword(input, dots) {
  const sync = () => {
    dots.textContent = '•'.repeat(input.value.length);
    dots.scrollLeft = dots.scrollWidth;
  };
  for (const event of ['input', 'change', 'focus', 'blur']) input.addEventListener(event, sync);
  sync();
  return sync;
}
