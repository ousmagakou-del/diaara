export function haptic(type = 'light') {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  try {
    if (type === 'medium') navigator.vibrate(20);
    else if (type === 'success') navigator.vibrate([15, 50, 15]);
    else navigator.vibrate(10);
  } catch {}
}