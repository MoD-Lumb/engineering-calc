declare module '*.yaml' {
  const value: unknown;
  export default value;
}

declare module '*.yml' {
  const value: unknown;
  export default value;
}

declare module '*.mdx' {
  import type { ComponentType } from 'react';
  const Component: ComponentType<{ components?: Record<string, ComponentType> }>;
  export default Component;
}
