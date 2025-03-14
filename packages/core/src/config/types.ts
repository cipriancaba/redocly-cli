import type { ProblemSeverity, UserContext } from '../walk';
import type {
  Oas3PreprocessorsSet,
  SpecMajorVersion,
  Oas3DecoratorsSet,
  Oas2RuleSet,
  Oas2PreprocessorsSet,
  Oas2DecoratorsSet,
  Oas3RuleSet,
  SpecVersion,
  Async2PreprocessorsSet,
  Async2DecoratorsSet,
  Async2RuleSet,
  RuleMap,
} from '../oas-types';

import type { NodeType } from '../types';
import { Location } from '../ref-utils';
import type { SkipFunctionContext } from '../visitors';
import {
  BuiltInAsync2RuleId,
  BuiltInCommonOASRuleId,
  BuiltInCommonRuleId,
  BuiltInOAS2RuleId,
  BuiltInOAS3RuleId,
} from '../types/redocly-yaml';

export type RuleSeverity = ProblemSeverity | 'off';

export type RuleSettings = { severity: RuleSeverity };

export type PreprocessorSeverity = RuleSeverity | 'on';

export type RuleConfig =
  | RuleSeverity
  | ({
      severity?: ProblemSeverity;
    } & Record<string, any>);

export type PreprocessorConfig =
  | PreprocessorSeverity
  | ({
      severity?: ProblemSeverity;
    } & Record<string, any>);

export type DecoratorConfig = PreprocessorConfig;

export type StyleguideRawConfig<T = undefined> = {
  plugins?: (string | Plugin)[];
  extends?: string[];
  doNotResolveExamples?: boolean;
  recommendedFallback?: boolean;

  rules?: RuleMap<BuiltInCommonRuleId | BuiltInCommonOASRuleId, RuleConfig, T>;
  oas2Rules?: RuleMap<BuiltInOAS2RuleId, RuleConfig, T>;
  oas3_0Rules?: RuleMap<BuiltInOAS3RuleId, RuleConfig, T>;
  oas3_1Rules?: RuleMap<BuiltInOAS3RuleId, RuleConfig, T>;
  async2Rules?: RuleMap<BuiltInAsync2RuleId, RuleConfig, T>;

  preprocessors?: Record<string, PreprocessorConfig>;
  oas2Preprocessors?: Record<string, PreprocessorConfig>;
  oas3_0Preprocessors?: Record<string, PreprocessorConfig>;
  oas3_1Preprocessors?: Record<string, PreprocessorConfig>;
  async2Preprocessors?: Record<string, PreprocessorConfig>;

  decorators?: Record<string, DecoratorConfig>;
  oas2Decorators?: Record<string, DecoratorConfig>;
  oas3_0Decorators?: Record<string, DecoratorConfig>;
  oas3_1Decorators?: Record<string, DecoratorConfig>;
  async2Decorators?: Record<string, DecoratorConfig>;
};

export type ApiStyleguideRawConfig = Omit<StyleguideRawConfig, 'plugins'>;

export type ResolvedStyleguideConfig = PluginStyleguideConfig & {
  plugins?: Plugin[];
  recommendedFallback?: boolean;
  extends?: void | never;
  extendPaths?: string[];
  pluginPaths?: string[];
};

export type PreprocessorsConfig = {
  oas3?: Oas3PreprocessorsSet;
  oas2?: Oas2PreprocessorsSet;
  async2?: Async2PreprocessorsSet;
};

export type DecoratorsConfig = {
  oas3?: Oas3DecoratorsSet;
  oas2?: Oas2DecoratorsSet;
  async2?: Async2DecoratorsSet;
};

export type TypesExtensionFn = (
  types: Record<string, NodeType>,
  oasVersion: SpecVersion
) => Record<string, NodeType>;

export type TypeExtensionsConfig = Partial<Record<SpecMajorVersion, TypesExtensionFn>>;

export type CustomRulesConfig = {
  oas3?: Oas3RuleSet;
  oas2?: Oas2RuleSet;
  async2?: Async2RuleSet;
};

export type AssertionContext = Partial<UserContext> & SkipFunctionContext & { node: any };

export type AssertResult = { message?: string; location?: Location };
export type CustomFunction = (
  value: any,
  options: unknown,
  baseLocation: Location
) => AssertResult[];

export type AssertionsConfig = Record<string, CustomFunction>;

export type Plugin = {
  id: string;
  configs?: Record<string, PluginStyleguideConfig>;
  rules?: CustomRulesConfig;
  preprocessors?: PreprocessorsConfig;
  decorators?: DecoratorsConfig;
  typeExtension?: TypeExtensionsConfig;
  assertions?: AssertionsConfig;
};

export type PluginStyleguideConfig<T = undefined> = Omit<
  StyleguideRawConfig<T>,
  'plugins' | 'extends'
>;

export type ResolveHeader =
  | {
      name: string;
      envVariable?: undefined;
      value: string;
      matches: string;
    }
  | {
      name: string;
      value?: undefined;
      envVariable: string;
      matches: string;
    };

export type RawResolveConfig = {
  http?: Partial<HttpResolveConfig>;
  doNotResolveExamples?: boolean;
};

export type HttpResolveConfig = {
  headers: ResolveHeader[];
  customFetch?: Function;
};

export type ResolveConfig = {
  http: HttpResolveConfig;
};

export type Region = 'us' | 'eu';
export type Telemetry = 'on' | 'off';

export type AccessTokens = { [region in Region]?: string };

export type DeprecatedInRawConfig = {
  apiDefinitions?: Record<string, string>;
  lint?: StyleguideRawConfig;
  styleguide?: StyleguideRawConfig;
  referenceDocs?: Record<string, any>;
  apis?: Record<string, Api & DeprecatedInApi>;
} & DeprecatedFeaturesConfig;

export type Api = {
  root: string;
  styleguide?: ApiStyleguideRawConfig;
} & ThemeConfig;

export type DeprecatedInApi = {
  lint?: ApiStyleguideRawConfig;
} & DeprecatedFeaturesConfig;

export type ResolvedApi = Omit<Api, 'styleguide'> & {
  styleguide: ResolvedStyleguideConfig;
  files?: string[];
};

export type RawConfig = {
  apis?: Record<string, Api>;
  styleguide?: StyleguideRawConfig;
  resolve?: RawResolveConfig;
  region?: Region;
  organization?: string;
  files?: string[];
  telemetry?: Telemetry;
} & ThemeConfig;

// RawConfig is legacy, use RawUniversalConfig in public APIs
export type RawUniversalConfig = Omit<RawConfig, 'styleguide'> & StyleguideRawConfig;

export type FlatApi = Omit<Api, 'styleguide'> &
  Omit<ApiStyleguideRawConfig, 'doNotResolveExamples'>;

export type FlatRawConfig = Omit<RawConfig, 'styleguide' | 'resolve' | 'apis'> &
  Omit<StyleguideRawConfig, 'doNotResolveExamples'> & {
    resolve?: RawResolveConfig;
    apis?: Record<string, FlatApi>;
  } & ThemeRawConfig;

export type ResolvedConfig = Omit<RawConfig, 'apis' | 'styleguide'> & {
  apis: Record<string, ResolvedApi>;
  styleguide: ResolvedStyleguideConfig;
};

type DeprecatedFeaturesConfig = {
  'features.openapi'?: Record<string, any>;
  'features.mockServer'?: Record<string, any>;
};

export type ThemeConfig = {
  theme?: ThemeRawConfig;
};

export type ThemeRawConfig = {
  openapi?: Record<string, any>;
  mockServer?: Record<string, any>;
};

export type RulesFields =
  | 'rules'
  | 'oas2Rules'
  | 'oas3_0Rules'
  | 'oas3_1Rules'
  | 'async2Rules'
  | 'preprocessors'
  | 'oas2Preprocessors'
  | 'oas3_0Preprocessors'
  | 'oas3_1Preprocessors'
  | 'async2Preprocessors'
  | 'decorators'
  | 'oas2Decorators'
  | 'oas3_0Decorators'
  | 'oas3_1Decorators'
  | 'async2Decorators';

export enum AuthProviderType {
  OIDC = 'OIDC',
  SAML2 = 'SAML2',
  BASIC = 'BASIC',
}

export enum ApigeeDevOnboardingIntegrationAuthType {
  SERVICE_ACCOUNT = 'SERVICE_ACCOUNT',
  OAUTH2 = 'OAUTH2',
}

export const DEFAULT_TEAM_CLAIM_NAME = 'https://redocly.com/sso/teams';
