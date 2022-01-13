const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const fs = require('fs');
const fsPromises = require('fs').promises;
const fse = require('fs-extra')
const path = require('path');
const ora = require('ora');
const glob = require('glob');
const axios = require('axios').default;

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
.demandOption(['res'], "Incorrect or no resource folder selected!")
.argv;

let getDirectories = (src, callback) => {
    glob(src + '/**/*', callback);
}

let spinner = ora('Getting files list').start();
getDirectories(argv.res, (err, res) => {
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

        //TODO rollback everything on error, if backup
        Promise.all(files.map(file => {
            fsPromises.readFile(file)
            .then(data => {
                return axios.post('https://luac.mtasa.com/?compile=1&debug=0&obfuscate=3', data)
            }).then(response => {
                return fsPromises.writeFile(file + 'c', response.data)
            }).then(() => {
                console.log('tete');
                if (argv.backup && argv.del) return fse.remove(file)
            }).then(()=>{})
        })).then(spinner.succeed())


        let metaSpinner = ora('Editing meta.xml').start();
        const meta = res.filter(element => fs.lstatSync(path.resolve(__dirname, element)).isFile() && element.includes('meta.xml'))[0]
        let data = fs.readFileSync(meta).toString('utf8').replaceAll('.lua', '.luac')

        fs.writeFileSync(meta, data, { flag: 'w+' })
        metaSpinner.succeed()
    }
})