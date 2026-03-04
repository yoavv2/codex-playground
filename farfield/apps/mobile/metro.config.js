/**
 * Metro configuration for @farfield/mobile (Expo SDK 53).
 *
 * Adds monorepo workspace support so that Metro can resolve
 * @farfield/protocol from the packages/ directory without errors.
 *
 * Key additions over the default Expo Metro config:
 *   - watchFolders: includes the monorepo root so Metro sees package changes
 *   - resolver.nodeModulesPaths: workspace node_modules for hoisted deps
 *
 * @type {import('expo/metro-config').MetroConfig}
 */

const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// Monorepo root — two levels up from apps/mobile
const monorepoRoot = path.resolve(__dirname, "../..");

const config = getDefaultConfig(__dirname);

// Watch the entire monorepo so Metro picks up changes in workspace packages
config.watchFolders = [monorepoRoot];

// Allow Metro to resolve modules from the workspace root node_modules
// (for hoisted packages) in addition to the app's own node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Enable package.json "exports" field resolution so Metro can resolve
// @farfield/protocol which uses "exports" instead of "main"
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
