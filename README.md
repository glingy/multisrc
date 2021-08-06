# Multi-Source

This is an easy way of switching between source directories in a build environment. Specifically made for platformio where I often have many very similar projects with only the src folder being different. This allows you to pick one of several source folders and generate a symbolic link to the one selected which can then be used as the source folder in the build system.

### Example Project Structure
```
> sources
  > blinky
    > main.c
  > test
    > main.c
  ...
> .src -> sources/blinky
> .multisrc
```

This extension is enabled by the presence of a `.multisrc` file in the workspace root. The `.multisrc` file is also parsed as JSON to allow configuration of `sources` and `.src` paths for the sources folder and the link path respectively. This is the equivalent default when the file is empty:

```
{
  "sourcesFolder": "sources",
  "sourceLink": ".src"
}
```

You can switch between source directories by the status bar item in the bottom right which also displays the current source folder or by the "Pick Source Folder" command.