declare namespace EPUB {
    type MetaData = {
        title: string;
        author: string;
        // description: string;
        cover: string;
        /**
         * full path of the directory containing the opf file (inside extracted epub directory)
         */
        opfDir: string;
        ncx_depth: number;
        /** id of item with `[properties="nav"]` ie xhtml nav */
        navId?: string;
    };
    /**
     * map key is id of item
     */
    type Manifest = Map<
        string,
        {
            id: string;
            href: string;
            mediaType: string;

            // here for quick access, taken from toc
            title?: string;
            order?: number;
            level?: number;
        }
    >;
    // /** array of idref, defines display order*/
    // also including href for quick lookup (wont have to convert manifest to array each time to check find url)
    type Spine = {
        id: string;
        href: string;
    }[];
    type TOCElement = {
        navId: string;
        title: string;
        href: string;
        level: number;
        /**corresponding chapter id from spine */
        chapterId?: string;
    };
    /** key is `navId`, not same as `Spine.id` */
    type TOC = Map<string, TOCElement>;
    type NCXTree = {
        navId: string;
        /** index without including sub */
        ncx_index1: number;
        /** index including sub */
        ncx_index2: number;
        level: number;
        sub: NCXTree[];
    };
}
// export { EPUB };
