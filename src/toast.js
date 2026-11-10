let _toastId = 0;

export function toast(msg, type = 'info') {
  const el = document.getElementById('toast-root');
  if (!el) return;
  const id = 't' + (++_toastId);
  const icon = type === 'success' ? 'bi-check-circle-fill' : type === 'error' ? 'bi-x-circle-fill' : type === 'warning' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill';
  const div = document.createElement('div');
  div.id = id;
  div.className = `toast-msg ${type}`;
  /* the icon is a fixed class; the message is text, because it can echo back
     whatever the user typed (a bad table name, a rejected filter, ...) */
  const i = document.createElement('i');
  i.className = `bi ${icon}`;
  const span = document.createElement('span');
  span.textContent = msg;
  div.append(i, span);
  el.appendChild(div);
  setTimeout(() => {
    div.style.opacity = '0';
    div.style.transform = 'translateX(20px)';
    div.style.transition = 'all 0.3s ease';
    setTimeout(() => div.remove(), 300);
  }, 3000);
}
