const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const repoName = process.env.NEXT_PUBLIC_REPO_NAME || 'image-annotation-system';

export const getBasePath = () => basePath;

export const getAssetPath = (path: string) => {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${basePath}/${cleanPath}`;
};

export const getApiPath = (endpoint: string) => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${basePath}/api/${cleanEndpoint}`;
};

// For handling external URLs vs relative paths
export const isExternalUrl = (url: string) => {
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//');
};

export const resolveImagePath = (imagePath: string) => {
  // If it's an external URL, return as-is
  if (isExternalUrl(imagePath)) {
    return imagePath;
  }

  // If it's a relative path, add base path
  return getAssetPath(imagePath);
};
