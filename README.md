# mta-resource-compiler

This utility is made to compile `.lua` files for the MTA:SA.

This is the ideological successor to the [MTA Resource Tool](https://github.com/AlexRazor1337/MTA-Resource-Tool). But it is a lot more user friendly. Also, it can be used on any system(the MTA Resource Tool used .exe binary). As a drawback, this script uses official **online** API for this, because unix version of **luac_mta**(that thing that actually "compiles" scripts) is broken and nobody wants to fix it.

# Usage

Run script without any arguments and it will list all options and usage example.
```
node index.js
```

The only **required** arguments is `--res [folder]` or `-r` in short form. This is the path to the resource.

With `--backup [folder]` or `-b` you can specify where your resources will be saved before any operations. They will be saved as original folder name + current timestamp.

With `--del` or `-d` you can turn on deletion of original `.lua` files, works only when backup option is set. This is especially useful for any kind of CI/CD pipeline.

**meta.xml** will be edited automatically, `.lua` will be changed to `.luac`

# Example

This will compile resource in `resourceFolder`, save the original to the `backup/` and delete original `.lua` files.
```
node index.js -r resourceFolder -b backup -d
```