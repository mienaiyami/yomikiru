# User Guide

Welcome to Yomikiru! This guide will help you get the most out of your reading experience.

## Table of Contents

- [Getting Started](#getting-started)
- [File Organization](#file-organization)
- [Supported Formats](#supported-formats)
- [Third-Party Integration](#third-party-integration)
- [Troubleshooting](#troubleshooting)
- [Tips & Best Practices](#tips--best-practices)

## Getting Started

### First Launch

1. **Download and Install**: Get the latest version from the [releases page](https://github.com/mienaiyami/yomikiru/releases)
2. **Initial Setup**: Launch the app and configure your preferred settings
3. **Add Content**: Use the file browser to navigate to your manga/book collection
4. **Start Reading**: Click on any item to begin reading

### Basic Navigation

- **Library View**: Browse your collection with different view modes
- **Reader Interface**: Customize reading experience with various settings
- **Bookmarks**: Save your progress and favorite pages
- **Settings**: Access comprehensive customization options

## File Organization

### Recommended Folder Structure

For optimal organization and automatic recognition:

```
├─ DEFAULT LOCATION\
│  ├─ One Piece\
│  │  ├─ Chapter 1\
│  │  │  ├─ 001.png
│  │  │  ├─ 002.png
│  │  │  ├─ 003.png
│  │  │  ├─ 004.png
│  │  ├─ Chapter 2\
│  │  │  ├─ 001.png
│  │  ├─ Chapter 3.cbz
│  │  ├─ Chapter 4.pdf
│  ├─ Webtoon\
│  │  ├─ Chapter 1
│  │  ├─ Chapter 2.zip
│  ├─ Books\
│  │  ├─ Novel 1.epub
│  │  ├─ Novel 2.epub
```

### Organization Tips

- **Series Folders**: Create separate folders for each manga/book series
- **Chapter Naming**: Use consistent naming conventions (e.g., "Chapter 1", "Ch 001")
- **Image Formats**: PNG, JPG, JPEG, and WebP are supported
- **Archive Support**: CBZ, CBR, ZIP, and RAR files work seamlessly
- **Mixed Formats**: You can mix folders and archives within the same series

## Supported Formats

### Manga/Comics

| Format | Extension | Notes |
|--------|-----------|-------|
| Image Folders | `.png`, `.jpg`, `.jpeg`, `.webp` | Recommended for best performance |
| Comic Book Archive | `.cbz`, `.cbr` | Standard comic formats |
| Compressed Archives | `.zip`, `.rar` | Regular archives containing images |
| PDF Documents | `.pdf` | Supported with page navigation |

### Books/Novels

| Format | Extension | Notes |
|--------|-----------|-------|
| EPUB | `.epub` | Full support with bookmarks and notes |
| PDF | `.pdf` | Basic reading support |

### Performance Notes

- **Image Folders**: Fastest loading and navigation
- **Archives**: Slightly slower but more storage efficient
- **Large Files**: May require more memory for smooth operation

## Third-Party Integration

### TachiDesk Integration

Tachidesk users can optimize their download path:

1. Navigate to `%localappdata%\Tachidesk\`
2. Open `server.conf` with a text editor
3. Add or modify the download path:

    ```conf
    server.downloadsPath = "D:\\example\\path\\"
    ```

4. Remove the previous download folder if necessary
5. Restart both Tachidesk and Yomikiru

### Other Download Managers

- **Hakuneko**: Point download directory to your organized library
- **FMD**: Configure output path to match your folder structure
- **Manual Downloads**: Organize files according to the recommended structure

## Troubleshooting

### Common Issues

#### Archive Files Won't Open (Windows)

If ZIP, CBZ, or other archive files won't open:

1. Press `Win + S` and search for "PowerShell"
2. Right-click and select "Run as administrator"
3. Execute: `Set-ExecutionPolicy Unrestricted -Scope CurrentUser -Force`
4. Restart Yomikiru

#### Performance Issues

- **Large Collections**: Consider using SSD storage for better performance
- **Memory Usage**: Close other applications if experiencing slowdowns
- **Image Quality**: Reduce image quality in settings if needed
- **Hardware Acceleration**: Enable in settings for smoother experience

#### File Detection Problems

- **Unsupported Characters**: Avoid special characters in file/folder names
- **Path Length**: Keep file paths under 260 characters (Windows limitation)
- **Permissions**: Ensure Yomikiru has read access to your files
- **Network Drives**: Local storage is recommended for best performance

### Platform-Specific Notes

#### Windows

- Use forward slashes `/` or double backslashes `\\` in paths
- Avoid network mapped drives for better performance
- Consider Windows Defender exclusions for large collections

#### macOS

- Grant necessary permissions in System Preferences > Security & Privacy
- Use Finder to verify file permissions if needed

#### Linux

- Ensure proper file permissions (`chmod` if necessary)
- Some distros may require additional dependencies

## Tips & Best Practices

### Reading Experience

- **Keyboard Shortcuts**: Learn key bindings for faster navigation
- **Custom Themes**: Create personalized reading themes
- **Bookmarks**: Use bookmarks to track reading progress
- **Notes**: Take notes on important pages (EPUB support)

### Library Management

- **Consistent Naming**: Use consistent naming conventions
- **Regular Backups**: Backup your library and settings
- **Clean Organization**: Remove duplicates and organize regularly
- **Metadata**: Add cover images and metadata when possible

### Performance Optimization

- **Local Storage**: Store files locally for best performance
- **SSD Recommended**: Use SSD storage for large collections
- **Memory Management**: Monitor memory usage with large files
- **Regular Updates**: Keep Yomikiru updated for latest improvements

### Advanced Features

- **Portable Mode**: Use portable version for multiple devices
- **Custom Shortcuts**: Configure keyboard shortcuts to your preference
- **Multiple Windows**: Open multiple reading windows simultaneously
- **Anilist Integration**: Sync reading progress with Anilist

## Getting Help

- **Issues**: Report bugs on [GitHub Issues](https://github.com/mienaiyami/yomikiru/issues)
- **Discussions**: Join conversations on [GitHub Discussions](https://github.com/mienaiyami/yomikiru/discussions)
- **Documentation**: Check other docs in the `docs/` folder
- **Updates**: Watch the repository for latest updates and features

---

> [!TIP]
> For the best experience, organize your files according to the recommended structure before adding them to Yomikiru. This ensures proper series detection and navigation.

> [!NOTE]
> This guide covers the basic usage. For advanced features and customization options, explore the in-app settings and help sections.
