export type MangaItem = {
    mangaName: string;
    chapterName: string;
    date?: string;
    link: string;
    pages: number;
};
export type ChapterItem = MangaItem & {
    page: number;
};
export type MangaHistoryItem = {
    type: "image";
    data: {
        /**
         * Set of chapter names already read under same manga.
         */
        chaptersRead: string[];
        mangaLink: string;
    } & ChapterItem;
};

type BookItem = {
    title: string;
    author: string;
    link: string;
    //todo impl
    cover: string;
    date?: string;
    chapterData: {
        chapterName: string;
        id: string;
        /**
         * css query string of element to focus on load
         */
        elementQueryString: string;
    };
};
export type BookHistoryItem = {
    type: "book";
    data: BookItem;
};
export type HistoryItem = MangaHistoryItem | BookHistoryItem;

export type Manga_BookItem =
    | {
          type: "image";
          data: ChapterItem;
      }
    | {
          type: "book";
          data: BookItem;
      };
export type ListItemE = Manga_BookItem & {
    index: number;
    isBookmark: boolean;
    isHistory: boolean;
    focused: boolean;
};
