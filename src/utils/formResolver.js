import { getAppId } from '../api';

const formModules = import.meta.glob('../forms/*/*.{jsx,js}');
const schoolModules = import.meta.glob('../schools/*/forms/*/*.{jsx,js}');

const cache = new Map();

function key(formId, appId, type) {
  return `${appId}:${formId}:${type}`;
}

function findIn(globs, patterns) {
  for (const [p, loader] of Object.entries(globs)) {
    if (patterns.some((pat) => p.includes(pat))) return loader;
  }
  return null;
}

export async function resolveFormComponent(formId, type, appId = getAppId()) {
  const k = key(formId, appId || '', type);
  if (cache.has(k)) return cache.get(k);
  const a = appId || '';
  if (a) {
    const loader = findIn(schoolModules, [`/schools/${a}/forms/${formId}/${type}.`, `/schools/${a}/forms/${formId}/${type}`]);
    if (loader) {
      const mod = await loader();
      const comp = mod.default || mod;
      cache.set(k, comp);
      return comp;
    }
  }
  const loader = findIn(formModules, [`/forms/${formId}/${type}.`, `/forms/${formId}/${type}`]);
  if (!loader) throw new Error(`Form component not found: ${formId}/${type}`);
  const mod = await loader();
  const comp = mod.default || mod;
  cache.set(k, comp);
  return comp;
}

export function clearFormResolverCache() {
  cache.clear();
}
