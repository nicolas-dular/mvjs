// @flow

import path from 'path';
import _glob from 'glob';
import findUp from 'find-up';
import {promisify} from 'util';
import requireResolve from './requireResolve';
import {createDebug, warn} from './log';
import type {Context} from './transform';

const debug = createDebug(__filename);

const glob = promisify(_glob);

/**
 * Makes sure a path always starts with a `.` or a `/`.
 * Ex: a.js -> ./a.js
 */
function normalizePath(_path: string): string {
  if (_path.startsWith('.') || path.isAbsolute(_path)) {
    return _path;
  }
  return `./${_path}`;
}

/**
 * When changing the import declarations on existing modules, the updated path
 * should have a similar style to the current path.
 *
 * Ex:
 * -> import x from '../a';
 * <- import x from '../b'; // and not '../b.js'
 */
export function matchPathStyle(_path: string, referencePath: string): string {

  const referenceExt = path.extname(referencePath);
  if (!referenceExt) {

    const pathExt = path.extname(_path);
    const pathBasename = path.basename(_path, pathExt);
    const pathDirname = path.dirname(_path);

    // removing extension in case the referencePath doesn't have one
    return path.join(pathDirname, pathBasename);
  }

  return _path;
}

/**
 * Returns the absolute path that represents the path from the source file if
 * the current `file.path` was importing the source.
 * With this value we can check if the relative importSourcePath matches the
 * provided `sourcePath`.
 */
function getAbsoluteImportSourcePath(context: Context, importSourcePath: string): string {
  const { file } = context;
  return requireResolve(
    context,
    path.resolve(path.dirname(file.path), importSourcePath)
  );
}

export function updateSourcePath(context: Context, importSourcePath: string): string {

  const { file } = context;

  // absolute paths...
  // They are generaly not used "as-is", but there is a babel plugin that
  // allows absolute paths.
  // https://www.npmjs.com/package/babel-plugin-root-import
  // We are not going to do aything about it.
  if (path.isAbsolute(importSourcePath)) {
    debug(`Ignoring absolute path "${importSourcePath}" from "${file.path}".`);
    return importSourcePath;
  }

  // Not an absolute path and not a relative path, it's either a built-in
  // module or a dependency, ignore it.
  if (!importSourcePath.startsWith('.')) {
    return importSourcePath;
  }

  const { options: { absoluteSourcePath, absoluteTargetPath } } = context;
  const absoluteImportSourcePath = getAbsoluteImportSourcePath(context, importSourcePath);

  // The importSourcePath is not from the `sourcePath`, ignore it.
  if (absoluteSourcePath !== absoluteImportSourcePath) {
    return importSourcePath;
  }

  // ./src/c.js
  // a.js b.js
  // import x from '../a'; -> import x from '../b;
  const targetImportSourcePath = normalizePath(
    matchPathStyle(
      path.relative(path.dirname(file.path), absoluteTargetPath),
      importSourcePath
    )
  );

  debug(`Updating ${file.path}: ${importSourcePath} -> ${targetImportSourcePath}`);

  return targetImportSourcePath;
}

export async function findProjectPath(): Promise<string> {
  const projectPackageJson = await findUp('package.json');
  if (projectPackageJson == null) {
    const cwd = process.cwd();
    warn(`Could not find a "package.json" file on any parent directory, using "${cwd}" as a fallback.`);
    return cwd;
  }
  return path.dirname(projectPackageJson);
}

// TODO: use git and hg to consider ignored files
// note that the .git and .hg folder would need to match the package.json
// folder for this work properly.
// TODO: support .mjs
export async function findAllJSPaths(rootPath: string): Promise<Array<string>> {
  // THIS WILL NOT WORK ON WINDOWS
  return (await promisify(glob)(`${rootPath}/**/*.js`)).filter(p => !p.includes('node_modules'));
}

