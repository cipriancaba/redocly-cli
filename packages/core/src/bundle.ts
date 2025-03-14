import isEqual = require('lodash.isequal');
import {
  BaseResolver,
  resolveDocument,
  Document,
  ResolvedRefMap,
  makeRefId,
  makeDocumentFromString,
} from './resolve';
import { Oas3Rule, normalizeVisitors, Oas3Visitor, Oas2Visitor } from './visitors';
import { NormalizedNodeType, normalizeTypes, NodeType } from './types';
import { WalkContext, walkDocument, UserContext, ResolveResult, NormalizedProblem } from './walk';
import { detectSpec, getTypes, getMajorSpecVersion, SpecMajorVersion } from './oas-types';
import { isAbsoluteUrl, isRef, Location, refBaseName } from './ref-utils';
import { initRules } from './config/rules';
import { reportUnresolvedRef } from './rules/no-unresolved-refs';
import { isPlainObject, isTruthy } from './utils';
import { OasRef } from './typings/openapi';
import { isRedoclyRegistryURL } from './redocly';
import { RemoveUnusedComponents as RemoveUnusedComponentsOas2 } from './decorators/oas2/remove-unused-components';
import { RemoveUnusedComponents as RemoveUnusedComponentsOas3 } from './decorators/oas3/remove-unused-components';

import type { Config, StyleguideConfig } from './config';

export type Oas3RuleSet = Record<string, Oas3Rule>;

export enum OasVersion {
  Version2 = 'oas2',
  Version3_0 = 'oas3_0',
  Version3_1 = 'oas3_1',
}
export type BundleOptions = {
  externalRefResolver?: BaseResolver;
  config: Config;
  dereference?: boolean;
  base?: string;
  skipRedoclyRegistryRefs?: boolean;
  removeUnusedComponents?: boolean;
  keepUrlRefs?: boolean;
};

export async function bundle(
  opts: {
    ref?: string;
    doc?: Document;
  } & BundleOptions
) {
  const {
    ref,
    doc,
    externalRefResolver = new BaseResolver(opts.config.resolve),
    base = null,
  } = opts;
  if (!(ref || doc)) {
    throw new Error('Document or reference is required.\n');
  }

  const document =
    doc === undefined ? await externalRefResolver.resolveDocument(base, ref!, true) : doc;

  if (document instanceof Error) {
    throw document;
  }

  return bundleDocument({
    document,
    ...opts,
    config: opts.config.styleguide,
    externalRefResolver,
  });
}

export async function bundleFromString(
  opts: {
    source: string;
    absoluteRef?: string;
  } & BundleOptions
) {
  const { source, absoluteRef, externalRefResolver = new BaseResolver(opts.config.resolve) } = opts;
  const document = makeDocumentFromString(source, absoluteRef || '/');

  return bundleDocument({
    document,
    ...opts,
    externalRefResolver,
    config: opts.config.styleguide,
  });
}

type BundleContext = WalkContext;

export type BundleResult = {
  bundle: Document;
  problems: NormalizedProblem[];
  fileDependencies: Set<string>;
  rootType: NormalizedNodeType;
  refTypes?: Map<string, NormalizedNodeType>;
  visitorsData: Record<string, Record<string, unknown>>;
};

export async function bundleDocument(opts: {
  document: Document;
  config: StyleguideConfig;
  customTypes?: Record<string, NodeType>;
  externalRefResolver: BaseResolver;
  dereference?: boolean;
  skipRedoclyRegistryRefs?: boolean;
  removeUnusedComponents?: boolean;
  keepUrlRefs?: boolean;
}): Promise<BundleResult> {
  const {
    document,
    config,
    customTypes,
    externalRefResolver,
    dereference = false,
    skipRedoclyRegistryRefs = false,
    removeUnusedComponents = false,
    keepUrlRefs = false,
  } = opts;
  const specVersion = detectSpec(document.parsed);
  const specMajorVersion = getMajorSpecVersion(specVersion);
  const rules = config.getRulesForOasVersion(specMajorVersion);
  const types = normalizeTypes(
    config.extendTypes(customTypes ?? getTypes(specVersion), specVersion),
    config
  );

  const preprocessors = initRules(rules, config, 'preprocessors', specVersion);
  const decorators = initRules(rules, config, 'decorators', specVersion);

  const ctx: BundleContext = {
    problems: [],
    oasVersion: specVersion,
    refTypes: new Map<string, NormalizedNodeType>(),
    visitorsData: {},
  };

  if (removeUnusedComponents) {
    decorators.push({
      severity: 'error',
      ruleId: 'remove-unused-components',
      visitor:
        specMajorVersion === SpecMajorVersion.OAS2
          ? RemoveUnusedComponentsOas2({})
          : RemoveUnusedComponentsOas3({}),
    });
  }

  let resolvedRefMap = await resolveDocument({
    rootDocument: document,
    rootType: types.Root,
    externalRefResolver,
  });

  if (preprocessors.length > 0) {
    // Make additional pass to resolve refs defined in preprocessors.
    walkDocument({
      document,
      rootType: types.Root as NormalizedNodeType,
      normalizedVisitors: normalizeVisitors(preprocessors, types),
      resolvedRefMap,
      ctx,
    });
    resolvedRefMap = await resolveDocument({
      rootDocument: document,
      rootType: types.Root,
      externalRefResolver,
    });
  }

  const bundleVisitor = normalizeVisitors(
    [
      {
        severity: 'error',
        ruleId: 'bundler',
        visitor: makeBundleVisitor(
          specMajorVersion,
          dereference,
          skipRedoclyRegistryRefs,
          document,
          resolvedRefMap,
          keepUrlRefs
        ),
      },
      ...decorators,
    ],
    types
  );

  walkDocument({
    document,
    rootType: types.Root as NormalizedNodeType,
    normalizedVisitors: bundleVisitor,
    resolvedRefMap,
    ctx,
  });

  return {
    bundle: document,
    problems: ctx.problems.map((problem) => config.addProblemToIgnore(problem)),
    fileDependencies: externalRefResolver.getFiles(),
    rootType: types.Root,
    refTypes: ctx.refTypes,
    visitorsData: ctx.visitorsData,
  };
}

export function mapTypeToComponent(typeName: string, version: SpecMajorVersion) {
  switch (version) {
    case SpecMajorVersion.OAS3:
      switch (typeName) {
        case 'Schema':
          return 'schemas';
        case 'Parameter':
          return 'parameters';
        case 'Response':
          return 'responses';
        case 'Example':
          return 'examples';
        case 'RequestBody':
          return 'requestBodies';
        case 'Header':
          return 'headers';
        case 'SecuritySchema':
          return 'securitySchemes';
        case 'Link':
          return 'links';
        case 'Callback':
          return 'callbacks';
        default:
          return null;
      }
    case SpecMajorVersion.OAS2:
      switch (typeName) {
        case 'Schema':
          return 'definitions';
        case 'Parameter':
          return 'parameters';
        case 'Response':
          return 'responses';
        default:
          return null;
      }
    case SpecMajorVersion.Async2:
      switch (typeName) {
        case 'Schema':
          return 'schemas';
        case 'Parameter':
          return 'parameters';
        default:
          return null;
      }
  }
}

// function oas3Move

function makeBundleVisitor(
  version: SpecMajorVersion,
  dereference: boolean,
  skipRedoclyRegistryRefs: boolean,
  rootDocument: Document,
  resolvedRefMap: ResolvedRefMap,
  keepUrlRefs: boolean
) {
  let components: Record<string, Record<string, any>>;
  let rootLocation: Location;

  const visitor: Oas3Visitor | Oas2Visitor = {
    ref: {
      leave(node, ctx, resolved) {
        if (!resolved.location || resolved.node === undefined) {
          reportUnresolvedRef(resolved, ctx.report, ctx.location);
          return;
        }
        if (
          resolved.location.source === rootDocument.source &&
          resolved.location.source === ctx.location.source &&
          ctx.type.name !== 'scalar' &&
          !dereference
        ) {
          return;
        }

        // do not bundle registry URL before push, otherwise we can't record dependencies
        if (skipRedoclyRegistryRefs && isRedoclyRegistryURL(node.$ref)) {
          return;
        }

        if (keepUrlRefs && isAbsoluteUrl(node.$ref)) {
          return;
        }

        const componentType = mapTypeToComponent(ctx.type.name, version);
        if (!componentType) {
          replaceRef(node, resolved, ctx);
        } else {
          if (dereference) {
            saveComponent(componentType, resolved, ctx);
            replaceRef(node, resolved, ctx);
          } else {
            node.$ref = saveComponent(componentType, resolved, ctx);
            resolveBundledComponent(node, resolved, ctx);
          }
        }
      },
    },
    Root: {
      enter(root: any, ctx: any) {
        rootLocation = ctx.location;
        if (version === SpecMajorVersion.OAS3) {
          components = root.components = root.components || {};
        } else if (version === SpecMajorVersion.OAS2) {
          components = root;
        }
      },
    },
  };

  if (version === SpecMajorVersion.OAS3) {
    visitor.DiscriminatorMapping = {
      leave(mapping: Record<string, string>, ctx: any) {
        for (const name of Object.keys(mapping)) {
          const $ref = mapping[name];
          const resolved = ctx.resolve({ $ref });
          if (!resolved.location || resolved.node === undefined) {
            reportUnresolvedRef(resolved, ctx.report, ctx.location.child(name));
            return;
          }

          const componentType = mapTypeToComponent('Schema', version)!;
          if (dereference) {
            saveComponent(componentType, resolved, ctx);
          } else {
            mapping[name] = saveComponent(componentType, resolved, ctx);
          }
        }
      },
    };
  }

  function resolveBundledComponent(node: OasRef, resolved: ResolveResult<any>, ctx: UserContext) {
    const newRefId = makeRefId(ctx.location.source.absoluteRef, node.$ref);
    resolvedRefMap.set(newRefId, {
      document: rootDocument,
      isRemote: false,
      node: resolved.node,
      nodePointer: node.$ref,
      resolved: true,
    });
  }

  function replaceRef(ref: OasRef, resolved: ResolveResult<any>, ctx: UserContext) {
    if (!isPlainObject(resolved.node)) {
      ctx.parent[ctx.key] = resolved.node;
    } else {
      // TODO: why $ref isn't optional in OasRef?
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      delete ref.$ref;
      const obj = Object.assign({}, resolved.node, ref);
      Object.assign(ref, obj); // assign ref itself again so ref fields take precedence
    }
  }

  function saveComponent(
    componentType: string,
    target: { node: any; location: Location },
    ctx: UserContext
  ) {
    components[componentType] = components[componentType] || {};
    const name = getComponentName(target, componentType, ctx);
    components[componentType][name] = target.node;
    if (version === SpecMajorVersion.OAS3) {
      return `#/components/${componentType}/${name}`;
    } else {
      return `#/${componentType}/${name}`;
    }
  }

  function isEqualOrEqualRef(
    node: any,
    target: { node: any; location: Location },
    ctx: UserContext
  ) {
    if (
      isRef(node) &&
      ctx.resolve(node, rootLocation.absolutePointer).location?.absolutePointer ===
        target.location.absolutePointer
    ) {
      return true;
    }

    return isEqual(node, target.node);
  }

  function getComponentName(
    target: { node: any; location: Location },
    componentType: string,
    ctx: UserContext
  ) {
    const [fileRef, pointer] = [target.location.source.absoluteRef, target.location.pointer];
    const componentsGroup = components[componentType];

    let name = '';

    const refParts = pointer.slice(2).split('/').filter(isTruthy); // slice(2) removes "#/"
    while (refParts.length > 0) {
      name = refParts.pop() + (name ? `-${name}` : '');
      if (
        !componentsGroup ||
        !componentsGroup[name] ||
        isEqualOrEqualRef(componentsGroup[name], target, ctx)
      ) {
        return name;
      }
    }

    name = refBaseName(fileRef) + (name ? `_${name}` : '');
    if (!componentsGroup[name] || isEqualOrEqualRef(componentsGroup[name], target, ctx)) {
      return name;
    }

    const prevName = name;
    let serialId = 2;
    while (componentsGroup[name] && !isEqualOrEqualRef(componentsGroup[name], target, ctx)) {
      name = `${prevName}-${serialId}`;
      serialId++;
    }

    if (!componentsGroup[name]) {
      ctx.report({
        message: `Two schemas are referenced with the same name but different content. Renamed ${prevName} to ${name}.`,
        location: ctx.location,
        forceSeverity: 'warn',
      });
    }

    return name;
  }

  return visitor;
}
