# Yomikiru

**A powerful offline manga, manhwa, comic, and novel reader for desktop**

Yomikiru is a feature-rich desktop application designed for reading locally stored manga, comics, webtoons, and EPUB novels. Built with Electron and React, it offers a customizable and distraction-free reading experience.

[![Github Latest Release](https://img.shields.io/github/v/tag/mienaiyami/yomikiru?label=release&style=flat-square&logo=github)](https://github.com/mienaiyami/yomikiru/releases/latest) |
[![Github All Releases](https://img.shields.io/github/downloads/mienaiyami/yomikiru/total.svg?style=flat-square&logo=github)](https://github.com/mienaiyami/yomikiru/releases) |
[![License](https://img.shields.io/github/license/mienaiyami/yomikiru?style=flat-square)](LICENSE)

## Features

### Reading Experience

- **Multiple Reading Modes**: Vertical scroll, left-to-right, right-to-left navigation
- **Zen Mode**: Distraction-free fullscreen reading
- **Custom Scrolling**: Adjustable scroll speed with keyboard navigation
- **Dual Page View**: Side-by-side page display for manga/comics
- **Webtoon Support**: Seamless vertical scrolling with no gaps

### Customization

- **Multiple Themes**: Choose from various built-in themes
- **Custom Themes**: Create and share your own themes
- **Font Customization**: Adjust font size, family, and margins (EPUB)
- **Layout Options**: Customize gaps, margins, and page arrangements
- **Keyboard Shortcuts**: Fully customizable key bindings

### Library Management

- **Bookmarks**: Save progress with page numbers
- **Reading History**: Track your reading progress
- **Search & Filter**: Find content quickly in large libraries
- **Multiple Instances**: Open multiple reading windows

### Technical Features

- **Lightweight**: Low CPU and RAM usage
- **Offline First**: No internet connection required
- **Cross-Platform**: Windows, macOS, and Linux support
- **Portable Mode**: Run from USB drives or external storage
- **Drag & Drop**: Easy file management
- **File Explorer Integration**: Open files directly from system explorer

### Integrations

- **Anilist Support**: Sync reading progress with your Anilist account
- **TachiDesk Compatible**: Works with TachiDesk download structure
- **Archive Support**: CBZ, CBR, ZIP, RAR, and 7Z files
- **Multiple Formats**: Images, PDFs, and EPUB files

## Installation

### Quick Install

1. **Download** the latest version from [Releases](https://github.com/mienaiyami/yomikiru/releases/latest)
2. **Choose your platform**:
   - Windows: Download `.exe` (installer) or `.zip` (portable)
   - Linux: Download `.deb` (Debian/Ubuntu)
3. **Install and launch** the application

## Beta Version

Beta versions are available for users who want to try the latest features before they're released to the stable channel. Beta versions may contain bugs and are not recommended for production use.

### Accessing Beta Releases

- **Beta Releases**: Available on the [Releases page](https://github.com/mienaiyami/yomikiru/releases) (marked as "Pre-release")
- **Beta Branch**: Check the `beta` branch for the latest development code

### Beta vs Stable

- **Stable**: Recommended for regular use, thoroughly tested
- **Beta**: Latest features, may have bugs, suitable for testing and feedback

> [!WARNING]
> Beta versions may have database schema changes that are not backward compatible. Always backup your data before using beta versions.

> [!NOTE]
> If you're using a version older than 2.20.0, please update to the latest stable version to avoid automatic beta installations.

## Supported Formats

### Images & Comics

- **Image Formats**: `.jpg`, `.jpeg`, `.png`, `.webp`, `.svg`, `.apng`, `.gif`, `.avif`
- **Archive Formats**: `.zip`, `.cbz`, `.7z`, `.rar`, `.cbr`
- **Document Formats**: `.pdf` (image-based reading)

### Books & Novels

- **EPUB**: Full support with bookmarks, notes, and customization
- **PDF**: Basic reading support

> [!TIP]
> **Recommended**: Use folders with images instead of archives for the best performance and experience.

## Who Is This App For?

- **Manga Enthusiasts**: Read downloaded manga with optimal page layout and navigation
- **Comic Readers**: Enjoy comics with customizable viewing modes
- **Webtoon Fans**: Seamless vertical scrolling experience
- **Novel Readers**: EPUB support with extensive customization
- **Collectors**: Organize and manage large digital libraries
- **Offline Users**: No internet connection required for reading

## What It Doesn't Do

- **No Content Hosting**: Doesn't host or provide access to online content
- **No Downloader**: Doesn't download content from the internet
- **No Streaming**: Works only with locally stored files

## Development Roadmap

### Current Focus

- **Gallery View**: Implement gallery view for home page
- **UI Components**: Migrate to custom Radix UI components for better accessibility
- **Styling System**: Complete redesign of the styling system
- **Modern Stack**: Consider migration to Vite and Tanstack Query

### Future Plans

- **Windows 7 Deprecation**: Moving to newer Electron version (post-gallery view)
- **Enhanced Performance**: Optimization for large collections
- **Additional Formats**: Expand supported file types

## Documentation

- **[User Guide](docs/GUIDE.md)**: Complete user manual and tips
- **[Screenshots](docs/SCREENSHOTS.md)**: Visual overview of features
- **[Build Guide](docs/build.md)**: Development setup and compilation
- **[Contributing](docs/contribute.md)**: How to contribute to the project

## Support & Issues

- **Bug Reports**: [GitHub Issues](https://github.com/mienaiyami/yomikiru/issues)
- **Feature Requests**: [GitHub Issues](https://github.com/mienaiyami/yomikiru/issues)
- **Discussions**: [GitHub Discussions](https://github.com/mienaiyami/yomikiru/discussions)
- **Documentation**: Check the `docs/` folder for detailed guides

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

### Past Supporters

- @Tpztan

### Built With

- [Electron](https://www.electronjs.org/) - Cross-platform desktop apps
- [React](https://reactjs.org/) - User interface library
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [Drizzle ORM](https://orm.drizzle.team/) - Database management
- [Redux Toolkit](https://redux-toolkit.js.org/) - State management

---

![info](https://github.com/mienaiyami/mienaiyami/blob/main/metrics.plugin.people.repository.svg)

<div align="center">

**[Download Now](https://github.com/mienaiyami/yomikiru/releases/latest)** • **[Documentation](docs/GUIDE.md)** • **[Screenshots](docs/SCREENSHOTS.md)**

</div>
