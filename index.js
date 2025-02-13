import axios from 'axios';
import fastGlob from 'fast-glob';
import fsExtra from 'fs-extra';
import { existsSync, lstatSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import ora from 'ora';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const CONFIG = {
  VALID_LEVELS: ['1', '2', '3'],
  DEFAULT_LEVEL: '3',
  LUA_COMPILE_URL: 'https://luac.mtasa.com/',
  FILE_EXTENSION: '.lua',
  COMPILED_EXTENSION: '.luac',
};

// CLI configuration
const parseArguments = () => {
  return yargs(hideBin(process.argv))
    .usage('node $0 -r resourceFolder -b backup -d')
    .options({
      res: {
        alias: 'r',
        describe: 'Resource folder path',
        type: 'string',
        coerce: validateDirectory,
      },
      backup: {
        alias: 'b',
        describe: 'Backup folder for resources',
        type: 'string',
        coerce: validateOrCreateBackupDirectory,  // Changed this line
      },
      level: {
        alias: 'l',
        describe: 'Obfuscation level',
        type: 'string',
        coerce: (arg) => CONFIG.VALID_LEVELS.includes(arg) ? arg : undefined,
        default: CONFIG.DEFAULT_LEVEL,
      },
      del: {
        alias: 'd',
        describe: 'Delete original files, works only with the backup flag',
        type: 'boolean',
      },
    })
    .demandOption(['res'], 'Incorrect or no resource folder selected!')
    .parse();
};

const validateDirectory = (arg) => {
  if (!arg) return undefined;
  const resolvedPath = path.resolve(arg);
  return existsSync(resolvedPath) && lstatSync(resolvedPath).isDirectory()
    ? resolvedPath
    : undefined;
};

// New function to validate or create backup directory
const validateOrCreateBackupDirectory = (arg) => {
  if (!arg) return undefined;
  const resolvedPath = path.resolve(arg);
  
  // If directory exists, validate it
  if (existsSync(resolvedPath)) {
    return lstatSync(resolvedPath).isDirectory() ? resolvedPath : undefined;
  }
  
  // If directory doesn't exist, create it
  try {
    fsExtra.mkdirSync(resolvedPath, { recursive: true });
    return resolvedPath;
  } catch (error) {
    console.error(`Failed to create backup directory: ${error.message}`);
    return undefined;
  }
};

const getDirectories = async (src) => {
  const resourcePath = path.join(src, '/**/*').replace(/\\/g, '/');
  const dirs = await fastGlob([resourcePath]);
  if (dirs.length === 0) {
    throw new Error('No directories found');
  }
  return dirs;
};

const createBackup = async (sourcePath, backupBasePath) => {
  const timestamp = new Date().getTime();
  const backupFolder = path.join(
    backupBasePath,
    `${path.basename(sourcePath)}_${timestamp}`
  );
  
  const spinner = ora('Creating backup...').start();
  try {
    await fsExtra.copy(sourcePath, backupFolder);
    spinner.succeed(`Backup created at "${backupFolder}"`);
    return backupFolder;
  } catch (error) {
    spinner.fail('Backup creation failed');
    throw error;
  }
};

const compileLuaFile = async (filePath, obfuscationLevel) => {
  const fileContent = await fs.readFile(filePath);
  const response = await axios.post(
    `${CONFIG.LUA_COMPILE_URL}?compile=1&debug=0&obfuscate=${obfuscationLevel}`,
    fileContent
  );
  const compiledPath = `${filePath}c`;
  await fs.writeFile(compiledPath, response.data);
  return compiledPath;
};

const updateMetaXml = async (metaPath) => {
  const spinner = ora('Updating meta.xml').start();
  try {
    const content = await fs.readFile(metaPath, 'utf8');
    const updatedContent = content.replace(
      new RegExp(CONFIG.FILE_EXTENSION, 'g'),
      CONFIG.COMPILED_EXTENSION
    );
    await fs.writeFile(metaPath, updatedContent);
    spinner.succeed('meta.xml updated successfully');
  } catch (error) {
    spinner.fail('Failed to update meta.xml');
    throw error;
  }
};

const main = async () => {
  const argv = parseArguments();
  const mainSpinner = ora('Processing files...').start();

  try {
    // Get all files in the directory
    const files = await getDirectories(argv.res);
    mainSpinner.succeed('Files found');

    // Create backup if requested
    if (argv.backup) {
      await createBackup(argv.res, argv.backup);
    }

    // Filter and process Lua files
    const luaFiles = files.filter(
      (file) => 
        lstatSync(file).isFile() && 
        path.extname(file) === CONFIG.FILE_EXTENSION
    );

    // Compile files
    const compileSpinner = ora('Compiling files').start();
    try {
      await Promise.all(
        luaFiles.map(async (file) => {
          await compileLuaFile(file, argv.level);
          if (argv.backup && argv.del) {
            await fsExtra.remove(file);
          }
        })
      );
      compileSpinner.succeed('Files compiled successfully');
    } catch (error) {
      compileSpinner.fail('Compilation failed');
      throw error;
    }

    // Update meta.xml
    const metaFile = files.find((file) => path.basename(file) === 'meta.xml');
    if (metaFile) {
      await updateMetaXml(metaFile);
    }

  } catch (error) {
    mainSpinner.fail(`Error: ${error.message}`);
    
    // If backup exists and operation failed, we could implement rollback here
    if (argv.backup) {
      try {
        await fsExtra.remove(argv.res);
        await fsExtra.move(argv.backup, argv.res);
      } catch (rollbackError) {
        console.error(`Rollback failed: ${rollbackError.message}`);
      }
    }
    throw error;
  }
};

// Run the application
main().catch(console.error);
