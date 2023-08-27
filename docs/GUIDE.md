# Guides

## Recommended Folder structure

<ul>
    <li>
        DEFAULT LOCATION\
        <ul>
            <li>
                One Piece\
                <ul>
                    <li>
                        Chapter 1\ <"Open" here</code>
                        <ul>
                            <li>001.png</li>
                            <li>002.png</li>
                            <li>003.png</li>
                            <li>004.png</li>
                            <li>...</li>
                        </ul>
                    </li>
                    <li>
                        Chapter 2\
                        <ul>
                            <li>001.png</li>
                            <li>...</li>
                        </ul>
                    </li>
                    <li>Chapter 3.cbz</li>
                    <li>Chapter 4.pdf</li>
                    <li>...</li>
                </ul>
            </li>
            <li>
                Bleach\
                <ul>
                    <li>
                        Chapter 1\ <"Open" here</code>
                        <ul>
                            <li>001.png</li>
                        </ul>
                    </li>
                    <li>Chapter 2.zip</li>
                </ul>
            </li>
            <li>...</li>
        </ul>
    </li>
</ul>

## TachiDesk

If you are using [Tachidesk](https://github.com/Suwayomi/Tachidesk-Server) to download your manga, it will be better to change your download path.

1. Go to `%localappdata%\Tachidesk\`.
2. Open `server.conf` with notepad.
3. Change or add and save.
    ```
    server.downloadsPath = "D:\\example\\path\\"
    ```
4. You might need to delete folder set as previous path for it to work right.
