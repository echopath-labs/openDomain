import { EXPOSURE_ORDER } from "./governance.mjs";

const EXPOSURE_RANK = new Map(EXPOSURE_ORDER.map((value, index) => [value, index]));

export function analyzeGovernance(governance, options = {}) {
  const products = governance.products ?? governance.manifest?.products ?? [];
  const domainGroups = governance.domainGroups ?? governance.manifest?.domain_groups ?? [];
  const file = governance.file ?? "opendomain/governance.yaml";
  const sourceFilesByGroup = options.sourceFilesByGroup ?? new Map();
  const prerequisiteFailed = options.prerequisiteFailed === true;
  const productGraph = buildGraph("product", products, file);
  const groupGraph = buildGraph("domain_group", domainGroups, file);
  const errors = [...productGraph.errors, ...groupGraph.errors];
  const productsById = new Map(products.map((node) => [node.id, node]));
  const groupsById = new Map(domainGroups.map((node) => [node.id, node]));

  errors.push(...validateGroupParents(domainGroups, productsById, file));
  errors.push(...validateCrossProductDependencies(domainGroups, groupsById, productsById, file));
  errors.push(...validateExposureEdges("product", productGraph, file));
  errors.push(...validateExposureEdges("domain_group", groupGraph, file));
  errors.push(...validateForbiddenDependencies("product", productGraph, file));
  errors.push(...validateForbiddenDependencies("domain_group", groupGraph, file));

  const orderedErrors = uniqueIssues(errors).sort(compareIssues);
  const publicationClosures = orderedErrors.length === 0 && !prerequisiteFailed
    ? buildPublicationClosures({
        products,
        domainGroups,
        productGraph,
        groupGraph,
        sourceFilesByGroup
      })
    : [];

  return {
    schema_version: governance.manifest?.schema_version ?? null,
    manifest: file,
    derived: true,
    authoritative_source: "OpenDomain governance manifest and semantic source files, not this derived graph",
    prerequisite_status: prerequisiteFailed ? "fail" : "pass",
    products: products.map(publicNode),
    domain_groups: domainGroups.map(publicGroup),
    dependency_graph: {
      products: graphEvidence(productGraph),
      domain_groups: graphEvidence(groupGraph)
    },
    publication_closures: publicationClosures,
    errors: orderedErrors,
    warnings: []
  };
}

function buildGraph(nodeType, nodes, file) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const adjacency = new Map(nodes.map((node) => [node.id, []]));
  const errors = [];

  for (const node of nodes) {
    for (const target of node.dependencies) {
      if (target === node.id) {
        errors.push(issue({
          code: "self_dependency",
          file,
          field: `${nodeType}.${node.id}.dependencies`,
          problem: `${label(nodeType)} '${node.id}' depends on itself.`,
          fix: "Remove the self dependency."
        }));
        continue;
      }
      if (!nodesById.has(target)) {
        errors.push(issue({
          code: "missing_dependency_target",
          file,
          field: `${nodeType}.${node.id}.dependencies`,
          problem: `${label(nodeType)} '${node.id}' depends on unknown target '${target}'.`,
          fix: `Declare ${label(nodeType).toLowerCase()} '${target}' or correct the dependency id.`
        }));
        continue;
      }
      adjacency.get(node.id).push(target);
    }
    adjacency.get(node.id).sort(compareText);

    for (const target of node.forbidden_dependencies) {
      if (!nodesById.has(target)) {
        errors.push(issue({
          code: "missing_forbidden_dependency_target",
          file,
          field: `${nodeType}.${node.id}.forbidden_dependencies`,
          problem: `${label(nodeType)} '${node.id}' forbids unknown target '${target}'.`,
          fix: `Declare ${label(nodeType).toLowerCase()} '${target}' or correct the forbidden dependency id.`
        }));
      }
    }
  }

  const cycles = findCycles([...nodesById.keys()].sort(compareText), adjacency);
  for (const cycle of cycles) {
    errors.push(issue({
      code: "dependency_cycle",
      file,
      field: `${nodeType}.dependencies`,
      problem: `${label(nodeType)} dependency cycle detected: ${cycle.join(" -> ")}.`,
      fix: "Remove or reverse at least one dependency edge so the graph is acyclic."
    }));
  }

  return { nodeType, nodesById, adjacency, cycles, errors };
}

function validateGroupParents(groups, productsById, file) {
  const errors = [];
  for (const group of groups) {
    const product = productsById.get(group.product);
    if (!product) {
      continue;
    }
    if (rank(group.exposure) < rank(product.exposure)) {
      errors.push(issue({
        code: "group_more_public_than_product",
        file,
        field: `domain_group.${group.id}.exposure`,
        problem: `Domain group '${group.id}' exposure '${group.exposure}' is more public than product '${product.id}' exposure '${product.exposure}'.`,
        fix: "Make the group exposure equal to or more restrictive than its owning product."
      }));
    }
  }
  return errors;
}

function validateCrossProductDependencies(groups, groupsById, productsById, file) {
  const errors = [];
  for (const group of groups) {
    const sourceProduct = productsById.get(group.product);
    if (!sourceProduct) {
      continue;
    }
    for (const targetId of group.dependencies) {
      const target = groupsById.get(targetId);
      if (!target || target.product === group.product) {
        continue;
      }
      if (!sourceProduct.dependencies.includes(target.product)) {
        errors.push(issue({
          code: "undeclared_product_dependency",
          file,
          field: `domain_group.${group.id}.dependencies`,
          problem: `Cross-product group dependency '${group.id}' -> '${target.id}' lacks product dependency '${group.product}' -> '${target.product}'.`,
          fix: `Declare '${target.product}' in product '${group.product}' dependencies or remove the cross-product group edge.`
        }));
      }
    }
  }
  return errors;
}

function validateExposureEdges(nodeType, graph, file) {
  const errors = [];
  for (const sourceId of [...graph.nodesById.keys()].sort(compareText)) {
    const source = graph.nodesById.get(sourceId);
    for (const targetId of graph.adjacency.get(sourceId) ?? []) {
      const target = graph.nodesById.get(targetId);
      if (rank(target.exposure) > rank(source.exposure)) {
        errors.push(issue({
          code: "exposure_leak",
          file,
          field: `${nodeType}.${source.id}.dependencies`,
          problem: `${label(nodeType)} dependency leaks from '${source.id}' (${source.exposure}) to more restrictive '${target.id}' (${target.exposure}) via ${source.id} -> ${target.id}.`,
          fix: "Remove the dependency or move the target contract to an equal or more public exposure."
        }));
      }
    }
  }
  return errors;
}

function validateForbiddenDependencies(nodeType, graph, file) {
  const errors = [];
  for (const sourceId of [...graph.nodesById.keys()].sort(compareText)) {
    const source = graph.nodesById.get(sourceId);
    for (const targetId of source.forbidden_dependencies) {
      if (!graph.nodesById.has(targetId)) {
        continue;
      }
      const path = shortestPath(sourceId, targetId, graph.adjacency);
      if (path) {
        errors.push(issue({
          code: "forbidden_dependency",
          file,
          field: `${nodeType}.${source.id}.forbidden_dependencies`,
          problem: `${label(nodeType)} '${source.id}' reaches forbidden dependency '${targetId}' via ${path.join(" -> ")}.`,
          fix: "Remove an edge on the reported path or revise the forbidden declaration through review."
        }));
      }
    }
  }
  return errors;
}

function buildPublicationClosures({
  products,
  domainGroups,
  productGraph,
  groupGraph,
  sourceFilesByGroup
}) {
  return products
    .filter((product) => product.exposure === "public")
    .sort((left, right) => compareText(left.id, right.id))
    .map((product) => {
      const productSelection = traverseFrom([product.id], productGraph.adjacency);
      const productIds = productSelection.ids;
      const groupRoots = domainGroups
        .filter((group) => productIds.includes(group.product) && group.exposure === "public")
        .map((group) => group.id)
        .sort(compareText);
      const groupSelection = traverseFrom(groupRoots, groupGraph.adjacency);
      const domainGroupIds = groupSelection.ids;
      const files = domainGroupIds.flatMap((groupId) => (
        [...(sourceFilesByGroup.get(groupId) ?? [])].sort(compareText)
      )).sort(compareText);

      return {
        product_id: product.id,
        status: "pass",
        derived: true,
        product_ids: productIds,
        domain_group_ids: domainGroupIds,
        source_files: files,
        selection_paths: [
          ...productSelection.paths.map((entry) => ({ node_type: "product", ...entry })),
          ...groupSelection.paths.map((entry) => ({ node_type: "domain_group", ...entry }))
        ].sort((left, right) => (
          compareText(left.node_type, right.node_type)
          || compareText(left.id, right.id)
          || compareText(left.root_id, right.root_id)
        ))
      };
    });
}

function traverseFrom(rootIds, adjacency) {
  const roots = [...new Set(rootIds)].sort(compareText);
  const queue = roots.map((id) => ({ id, rootId: id, path: [id] }));
  const seen = new Set(roots);
  const paths = [];

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    paths.push({ id: current.id, root_id: current.rootId, path: current.path });
    for (const target of adjacency.get(current.id) ?? []) {
      if (seen.has(target)) {
        continue;
      }
      seen.add(target);
      queue.push({ id: target, rootId: current.rootId, path: [...current.path, target] });
    }
  }

  return {
    ids: [...seen].sort(compareText),
    paths: paths.sort((left, right) => compareText(left.id, right.id))
  };
}

function shortestPath(sourceId, targetId, adjacency) {
  const queue = [{ id: sourceId, path: [sourceId] }];
  const seen = new Set([sourceId]);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current.id === targetId && current.path.length > 1) {
      return current.path;
    }
    for (const next of adjacency.get(current.id) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push({ id: next, path: [...current.path, next] });
      }
    }
  }
  return null;
}

function findCycles(nodeIds, adjacency) {
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  const cycles = new Map();

  function visit(id) {
    visiting.add(id);
    stack.push(id);
    for (const target of adjacency.get(id) ?? []) {
      if (visiting.has(target)) {
        const start = stack.indexOf(target);
        const cycle = canonicalCycle([...stack.slice(start), target]);
        cycles.set(cycle.join("\u0000"), cycle);
      } else if (!visited.has(target)) {
        visit(target);
      }
    }
    stack.pop();
    visiting.delete(id);
    visited.add(id);
  }

  for (const id of nodeIds) {
    if (!visited.has(id)) {
      visit(id);
    }
  }
  return [...cycles.values()].sort((left, right) => compareText(left.join("\u0000"), right.join("\u0000")));
}

function canonicalCycle(cycle) {
  const nodes = cycle.slice(0, -1);
  let best = nodes;
  for (let index = 1; index < nodes.length; index += 1) {
    const rotated = [...nodes.slice(index), ...nodes.slice(0, index)];
    if (compareText(rotated.join("\u0000"), best.join("\u0000")) < 0) {
      best = rotated;
    }
  }
  return [...best, best[0]];
}

function graphEvidence(graph) {
  return {
    nodes: [...graph.nodesById.keys()].sort(compareText),
    edges: [...graph.adjacency.entries()]
      .flatMap(([from, targets]) => targets.map((to) => ({ from, to })))
      .sort((left, right) => compareText(left.from, right.from) || compareText(left.to, right.to)),
    cycles: graph.cycles
  };
}

function publicNode(node) {
  return {
    id: node.id,
    owners: [...node.owners],
    exposure: node.exposure,
    dependencies: [...node.dependencies],
    forbidden_dependencies: [...node.forbidden_dependencies]
  };
}

function publicGroup(node) {
  return {
    ...publicNode(node),
    product: node.product,
    source_root: node.source_root
  };
}

function rank(exposure) {
  return EXPOSURE_RANK.get(exposure) ?? Number.POSITIVE_INFINITY;
}

function label(nodeType) {
  return nodeType === "product" ? "Product" : "Domain group";
}

function issue({ code, file, field, problem, fix }) {
  return { severity: "error", code, file, field, problem, fix };
}

function uniqueIssues(issues) {
  const seen = new Set();
  return issues.filter((entry) => {
    const key = `${entry.code}\u0000${entry.field}\u0000${entry.problem}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function compareIssues(left, right) {
  return compareText(left.code, right.code)
    || compareText(left.field, right.field)
    || compareText(left.problem, right.problem);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
