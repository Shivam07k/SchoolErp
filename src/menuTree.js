/* The sidebar can be driven two ways:
     - the original menu, already nested by the server as
       { mainGroup: { subGroup: [{ title, formId, icon }] } }
     - a custom menu, a flat ordered list of rows each carrying its own parent
       and depth, which nests to any depth
   These helpers turn the flat list into the nested nodes the sidebar draws, and
   give the builder the same numbers ("3 links") the sidebar will show.

   Kept in its own module so the running app, the Customize page and its preview
   all read a menu the same way. */

/* Flat rows -> nested nodes. A row whose parent is missing (deleted underneath
   it, or saved before its parent existed) is shown at the top level rather than
   disappearing, and a cycle cannot hang the browser. */
export function buildMenuTree(rows) {
  const byId = new Map();
  for (const r of rows || []) {
    if (r && r.id != null) byId.set(String(r.id), { ...r, children: [] });
  }
  const roots = [];
  for (const r of rows || []) {
    if (!r || r.id == null) continue;
    const node = byId.get(String(r.id));
    const parent = r.parentId == null ? null : byId.get(String(r.parentId));
    /* Reject a parent that would make the node its own ancestor. */
    if (parent && parent !== node && !isAncestor(parent, node)) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function isAncestor(maybeAncestor, node, seen = new Set()) {
  const key = String(maybeAncestor.id);
  if (seen.has(key)) return false;
  seen.add(key);
  return maybeAncestor.children.some((c) => c === node || isAncestor(c, node, seen));
}

export const isSection = (n) => n && n.kind === 'section';

/* Children of a node that the sidebar will actually draw, in the order given. */
export const childrenOf = (n) => (n && Array.isArray(n.children) ? n.children : []);

/* Total links under a section, which is what the builder shows beside it. */
export function countLinks(node) {
  return node.children.reduce((s, c) => s + 1 + countLinks(c), 0);
}

/* Every non-section node under this one, at any depth. */
export function leaves(node) {
  return (node.children || []).reduce(
    (acc, c) => acc.concat(isSection(c) ? leaves(c) : [c]), []);
}

/* Flatten back to rows, adding the 1, 2, 3 numbers the sidebar and the builder
   both display. A section restarts the count, so each section numbers its own
   links from 1. Leaves carry their number; a section carries its numbered
   children (via the numberedChildren key) and no number of its own. */
export function numberMenu(nodes, out = [], counter = { n: 0 }) {
  for (const node of nodes) {
    const kids = childrenOf(node);
    if (isSection(node)) {
      const restarted = { n: 0 };
      node.numberedChildren = numberMenu(kids, [], restarted);
    } else if (kids.length) {
      /* a section-node that predates the kind flag: same restart */
      const restarted = { n: 0 };
      node.numberedChildren = numberMenu(kids, [], restarted);
    }
    const number = (!isSection(node) && !kids.length) ? ++counter.n : null;
    out.push({ ...node, number });
  }
  return out;
}

/* Everything the app needs from /api/menu in one place. */
export function menuFromResponse(d) {
  if (d && Array.isArray(d.custom) && d.custom.length) {
    return {
      source: 'custom',
      name: d.setName || '',
      reason: d.reason || '',
      setId: d.setId ?? null,
      tree: buildMenuTree(d.custom),
    };
  }
  return { source: 'original', name: '', reason: '', setId: null, tree: [] };
}

/* ------------------------- the builder's drop helpers -------------------------
   Shared with node tests: these describe where a dragged node lands.
   A "key" is the builder's draft-only identity for each node. */

/* Take a node out of wherever it is, so it can be dropped somewhere else. */
export function detach(nodes, key) {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].key === key) return { rest: [...nodes.slice(0, i), ...nodes.slice(i + 1)], node: nodes[i] };
    const hit = detach(nodes[i].children, key);
    if (hit) {
      const copy = [...nodes];
      copy[i] = { ...copy[i], children: hit.rest };
      return { rest: copy, node: hit.node };
    }
  }
  return null;
}

/* Change one node wherever it sits. */
export function patchKey(nodes, key, fn) {
  return nodes.map((n) => (n.key === key
    ? fn(n)
    : { ...n, children: patchKey(n.children, key, fn) }));
}

/* Put a node directly after another, keeping the other node's parent. */
export function afterKey(nodes, key, node) {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].key === key) {
      const out = [...nodes];
      out.splice(i + 1, 0, node);
      return out;
    }
    const hit = afterKey(nodes[i].children, key, node);
    if (hit) {
      const out = [...nodes];
      out[i] = { ...nodes[i], children: hit };
      return out;
    }
  }
  return null;
}

/* Put a node at the end of another node's children. */
export function intoKey(nodes, key, node) {
  return nodes.map((n) => (n.key === key
    ? { ...n, children: [...n.children, node] }
    : { ...n, children: intoKey(n.children, key, node) }));
}

/* True when the subtree under n contains key (used to refuse dropping a section
   inside itself). */
export const containsKey = (n, key) => n.key === key || n.children.some((c) => containsKey(c, key));

/* Remove a node and everything under it. */
export function removeNode(nodes, key) {
  const out = [];
  for (const n of nodes) {
    if (n.key === key) continue;
    out.push({ ...n, children: removeNode(n.children, key) });
  }
  return out;
}
