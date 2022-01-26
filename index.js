const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const fs = require('fs');
const fse = require('fs-extra')
const path = require('path');
const ora = require('ora');
const glob = require('glob');
const axios = require('axios').default;

const argv = yargs(hideBin(process.argv))
.usage('node $0 -r resourceFolder -b backup -d')
.options('res', {
    alias: 'r',
    describe: 'Resource folder path',
    type: 'string',
    coerce: arg =>
    arg && fs.existsSync(path.resolve(arg)) && fs.lstatSync(path.resolve(arg)).isDirectory() ? arg : undefined
})
.options('backup', {
    alias: 'b',
    describe: 'Backup folder for resources',
    type: 'string',
    coerce: arg =>
    arg && fs.existsSync(path.resolve(arg)) && fs.lstatSync(path.resolve(arg)).isDirectory() ? arg : undefined
})
.options('level', {
    alias: 'l',
    describe: 'Obfuscation level',
    type: 'string',
    coerce: arg => ['1', '2', '3'].includes(arg) ? arg : undefined,
    default: '3'
})
.options('del', {
    alias: 'd',
    describe: 'Delete original files, works only with the backup flag',
    type: 'boolean'
})
.demandOption(['res'], "Incorrect or no resource folder selected!")
.argv;

const getDirectories = (src, callback) => {
    glob(src + '/**/*', callback);
}

let spinner = ora('Getting files list').start();
getDirectories(path.resolve(argv.res), (err, res) => {
    if (err) {
        spinner.fail('Something went wrong!')
    } else {
        const files = res.filter(element => fs.lstatSync(path.resolve(element)).isFile() && path.extname(element) == '.lua')
        spinner.succeed()

        if (argv.backup) {
            let backupFolder = argv.backup + path.sep + path.basename(path.resolve(argv.res)) + new Date().getTime()
            spinner = ora('Making backup to \"' + backupFolder + '"').start();
            fse.copySync(argv.res, backupFolder)
            spinner.succeed()
        }Ы

        spinner = ora('Compiling files').start(); //TODO rollback everything on error, if backup
        Promise.all(files.map(file => {
            return fs.promises.readFile(file).then((data) => {
                return axios.post(`https://luac.mtasa.com/?compile=1&debug=0&obfuscate=${argv.level}`, data)
                .then(function (response) {
                    return fs.promises.writeFile(file + 'c', response.data).then(() => {
                        if (argv.backup && argv.del) fse.removeSync(file)
                    })
                })
            })
        })).then(() => spinner.succeed())

        const metaSpinner = ora('Editing meta.xml').start();
        const meta = res.filter(element => fs.lstatSync(path.resolve(element)).isFile() && element.includes('meta.xml'))[0]
        let data = fs.promises.readFile(meta).then(data => {
            fs.promises.writeFile(meta, data.toString('utf8').replace(/.lua/g, '.luac'), { flag: 'w+' }).then(() => {
                metaSpinner.succeed()
            })
        })
    }
})