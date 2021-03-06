#!/usr/bin/env node

// @flow

import yargs from 'yargs';
import {executeTransform} from './runner';
import {movePaths} from './move';
import {validate, createMovePaths, DEFAULT} from './options';
import {createDebug} from './log';
import {expandDirectoryPaths} from './path';

const debug = createDebug(__filename);

const {argv} = yargs
  .wrap(Math.min(120, yargs.terminalWidth()))
  .usage(`$0 - moves a JavaScript module and updates all import references in the project.`)
  .example(
    `$0 ./a.js ./b.js`,
    `Moves "a.js" to "b.js" and updates the other modules importing "a.js" to now import "b.js".`
  )
  .example(
    `$0 --recast.quote='double' ./a.js ./b.js`,
    `Recast options can be changed by using --recast.optionName notation.\n` +
    `In this example the codemoded files are going to have double quotes for all strings.\n` +
    `See https://github.com/benjamn/recast/blob/master/lib/options.js`
  )
  .option('parser', {
    describe: `jscodeshift's parser option.\nSee https://github.com/facebook/jscodeshift#parser`,
    default: DEFAULT.parser
  })
  .demandCommand(2)
  .help();

process.on('unhandledRejection', e => {
  const errStringRep = e ? e.stack ? e.stack : e.message : '<undefined-error>';
  process.stderr.write(errStringRep);
});

async function main() {
  const allNonOptionlArgs = argv._.slice();
  const targetPath = allNonOptionlArgs.pop();
  const sourcePaths = allNonOptionlArgs;
  debug('sourcePaths', sourcePaths.join(' '));
  debug('targetPath', targetPath);

  const movePathMap = createMovePaths(await validate({
    sourcePaths,
    targetPath
  }));
  const transformOptions = {
    expandedPaths: await expandDirectoryPaths(movePathMap),
    parser: argv.parser,
    recastOptions: argv.recast
  };
  await executeTransform(transformOptions);
  await movePaths(movePathMap);
}

main();
