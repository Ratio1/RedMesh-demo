export interface RedMeshFeature {
  id: string;
  label: string;
  description: string;
  category: 'service' | 'web' | 'diagnostic';
}

export const REDMESH_FEATURE_CATALOG: RedMeshFeature[] = [
  {
    id: 'service_info_common',
    label: 'Service fingerprinting',
    description: 'Collect banner and version data for common network services.',
    category: 'service'
  },
  {
    id: 'service_info_ssl',
    label: 'TLS/SSL diagnostics',
    description: 'Evaluate TLS configuration and highlight weak cipher suites.',
    category: 'service'
  },
  {
    id: 'web_test_common',
    label: 'Common exposure scan',
    description: 'Probe default admin panels, disclosed files, and common misconfigurations.',
    category: 'web'
  },
  {
    id: 'web_test_security_headers',
    label: 'Security headers audit',
    description: 'Check HSTS, CSP, X-Frame-Options, and other critical response headers.',
    category: 'web'
  },
  {
    id: 'web_test_path_traversal',
    label: 'Path traversal probe',
    description: 'Attempt non-destructive traversal payloads to detect directory exposure.',
    category: 'web'
  }
];

export function getDefaultFeatureIds(): string[] {
  return REDMESH_FEATURE_CATALOG.map((feature) => feature.id);
}
