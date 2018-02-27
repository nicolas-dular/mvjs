// @flow

import fs from 'fs';
import type {Stats} from 'fs';
import path from 'path';
import {promisify} from 'util';

const fsStat = promisify(fs.stat);

export type MoveOptions = {
  sourcePaths: Array<string>,
  targetPath: string,
};

export type PathMap = {
  [string]: string
};

export const SUPPORTED_EXTENSIONS: Set<string> = new Set(
  ['js', 'jsx', 'mjs', 'es', 'es6']
);
export const SUPPORTED_EXTENSIONS_DOTTED: Set<string> = new Set(
  [...Array.from(SUPPORTED_EXTENSIONS, ext => `.${ext}`)]
);

export const DEFAULT = {
  parser: 'flow',
  recast: {quote: 'single'}
};

async function gracefulFsStat(_path: string): Promise<?Stats> {
  try {
    return await fsStat(_path);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // if file doesn't exists return null
      return null;
    }
    throw error;
  }
}

async function validateSourcePaths(options: MoveOptions): Promise<void> {
  const {sourcePaths} = options;

  // All sourcePaths should exist and should be files
  await sourcePaths
    .map(sourcePath => ({sourcePath, stat: gracefulFsStat(sourcePath)}))
    .forEach(async ({sourcePath, stat}) => {
      const s = await stat;
      if (!s) {
        throw new Error(
          `Source "${sourcePath}" doesn't exist.`
        );
      }
      if (!s.isFile()) {
        // TODO Allow moving folders
        throw new Error(
          `Only files can be moved, and "${sourcePath}" is not a file.\n` +
          `There are plans to allow moving folders.`
        );
      }
    });

  sourcePaths
    .map(sourcePath => ({sourcePath, ext: path.extname(sourcePath)}))
    .forEach(({sourcePath, ext}) => {
      if (!SUPPORTED_EXTENSIONS_DOTTED.has(ext)) {
        throw new Error(
          `Can't move "${sourcePath}". Supported extensions: ` +
          `${Array.from(SUPPORTED_EXTENSIONS).join(', ')}.`
        );
      }
    });
}

async function validateTargetPath(options: MoveOptions): Promise<void> {
  const {sourcePaths, targetPath} = options;
  if (sourcePaths.length === 1) {
    // The targetPath should not exist
    const targetExists = await gracefulFsStat(targetPath);
    if (targetExists) {
      throw new Error(
        `Target "${targetPath}" already exists.`
      );
    }

    const targetExt = path.extname(targetPath);
    if (!SUPPORTED_EXTENSIONS_DOTTED.has(targetExt)) {
      throw new Error(
        `Can't move to "${targetPath}". Supported extensions: ` +
        `${Array.from(SUPPORTED_EXTENSIONS).join(', ')}.`
      );
    }
  } else {
    // For multiple sourcePaths, targetPath needs to be a folder.
    const targetStat = await fsStat(targetPath);
    if (!targetStat.isDirectory()) {
      throw new Error(
        `Multiple source paths were provided but "${targetPath}" is not a folder.`
      );
    }
  }
}

export async function validate(options: MoveOptions): Promise<MoveOptions> {
  await Promise.all([
    validateSourcePaths(options),
    validateTargetPath(options)
  ]);
  return options;
}

export function normalize(options: MoveOptions): PathMap {
  const {sourcePaths, targetPath} = options;
  const resolvedTargetPath = path.resolve(targetPath);
  if (sourcePaths.length === 1) {
    return {
      [path.resolve(sourcePaths[0])]: resolvedTargetPath
    };
  }
  return sourcePaths.reduce((acc, sourcePath) => {
    acc[path.resolve(sourcePath)] = path.join(resolvedTargetPath, path.basename(sourcePath))
    return acc;
  }, {});
}
