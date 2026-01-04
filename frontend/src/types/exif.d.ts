/**
 * EXIF.js 类型声明
 */
declare module 'exif-js' {
  interface ExifData {
    [key: string]: any;
    DateTimeOriginal?: string;
    DateTime?: string;
  }

  interface ExifStatic {
    getData(img: HTMLImageElement | File, callback: (this: HTMLImageElement | File) => void): void;
    getAllTags(img: HTMLImageElement | File): ExifData;
    getTag(img: HTMLImageElement | File, tag: string): any;
  }

  const EXIF: ExifStatic;
  export default EXIF;
}

