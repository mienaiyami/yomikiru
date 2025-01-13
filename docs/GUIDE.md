# Guides

## Recommended Folder structure

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
│  ├─ Bleach\
│  │  ├─ Chapter 1
│  │  ├─ Chapter 2.zip
```

## TachiDesk

If you are using [Tachidesk](https://github.com/Suwayomi/Tachidesk-Server) to download your manga, it will be better to change your download path.

1. Go to `%localappdata%\Tachidesk\`.
2. Open `server.conf` with notepad.
3. Change/add and save.

    ```conf
    server.downloadsPath = "D:\\example\\path\\"
    ```

4. You might need to delete folder previous set as download path for it to work right.

## Archive files issue in windows

If you are unable to open any files like zip,cbz,etc. then do this.
- Click `win+s`(windows search) and type powershell and open it as adminstrator.
- Run this command `Set-ExecutionPolicy Unrestricted -Scope CurrentUser -Force`.
- Restart Yomikiru.
