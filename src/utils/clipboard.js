export async function copyToClipboard(text, showSuccess) {
  try {
    await navigator.clipboard.writeText(text);
    if (showSuccess) showSuccess(`Copied "${text}" to clipboard`);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    if (showSuccess) showSuccess(`Copied "${text}" to clipboard`);
    return true;
  }
}
