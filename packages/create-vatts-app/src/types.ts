export type CreateAppOptions = {
  /** If omitted, we prompt */
  appName?: string;
  tailwind?: boolean;
  examples?: boolean;
  install?: boolean;

  /** If omitted, we prompt (default: true) */
  moduleAlias?: boolean;

  /** Alias prefix to use when moduleAlias=true (default: "@/") */
  alias?: string;

  pathRouter?: boolean

  typeScript?: boolean

  framework?: 'react' | 'vue'
};

export type CreateAppContext = {
  appName: string;
  rootDir: string;
  willTailwind: boolean;
  willRouteExample: boolean;
  willInstallDependencies: boolean;

  willUseModuleAlias: boolean;
  pathRouter: boolean

  /** Normalized alias prefix (ex: "@/") */
  moduleAlias: string;

  /** computed */
  vattsVersion: string;

  packageJson: Record<string, any>;
  typeScript: boolean

  framework: 'react' | 'vue'
};
