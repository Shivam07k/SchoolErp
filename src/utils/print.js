export function printElement(id) {
  const element = document.getElementById(id);
  if (!element) return;

  element.classList.add('print-target');
  window.print();
  window.setTimeout(() => element.classList.remove('print-target'), 0);
}
