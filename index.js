const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const fs = require('fs');
const fse = require('fs-extra')
const path = require('path');
const ora = require('ora');
const glob = require("glob");
const child_process = require('child_process');

// TODO Add usage and example
const argv = yargs(hideBin(process.argv))
.options('res', {
    alias: 'r',
    describe: 'Resource folder path',
    type: 'string',
    coerce: arg =>
    arg && fs.existsSync(path.resolve(__dirname, arg)) && fs.lstatSync(path.resolve(__dirname, arg)).isDirectory() ? arg : undefined
})
.options('backup', {
    alias: 'b',
    describe: 'Backup folder for resources',
    type: 'string',
    coerce: arg =>
    arg && fs.existsSync(path.resolve(__dirname, arg)) && fs.lstatSync(path.resolve(__dirname, arg)).isDirectory() ? arg : undefined
})
.options('level', {
    alias: 'l',
    describe: 'Obfuscation level',
    type: 'string',
    coerce: arg => ['e3', 'e2', 'e'].includes(arg) ? arg : undefined,
    default: 'e3'
})
.options('del', {
    alias: 'd',
    describe: 'Delete original files, works only with the backup flag',
    type: 'boolean'
})
.demandOption(['res'], console.error("Incorrect or no resource folder selected!"))
.argv;

let getDirectories = (src, callback) => {
    glob(src + '/**/*', callback);
}

let spinner = ora('Getting files list').start();
getDirectories(argv.res, (err, res) => {
    console.log(res);
    if (err) {
        spinner.fail('Something went wrong!')
    } else {
        let files = res.filter(element => fs.lstatSync(path.resolve(__dirname, element)).isFile() && path.extname(element) == '.lua')
        spinner.succeed()

        if (argv.backup) {
            let backupFolder = argv.backup + path.sep + path.basename(path.resolve(argv.res)) + new Date().getTime()
            spinner = ora('Making backup to \"' + backupFolder + '"').start();
            fse.copySync(argv.res, backupFolder)
            spinner.succeed()
        }

        spinner = ora('Compiling files').start();
        files.forEach(file => {
            child_process.execFile('luac_mta', ["-" + argv.level, "-o " + file + "c", file], () => {
                if (argv.backup && argv.del) {
                    fse.removeSync(file)
                }
            })
        });
        spinner.succeed()

        if (argv.meta) {
            spinner = ora('Editing meta.xml').start();
            const meta = res.filter(element => fs.lstatSync(path.resolve(__dirname, element)).isFile() && element.includes('meta.xml'))[0]
            let data = fs.readFileSync(meta).toString('utf8').replace('.lua', '.luac')

            fs.writeFileSync(meta, data, { flag: 'w+' })
            spinner.succeed()
        }
    }
})