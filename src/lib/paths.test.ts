import { describe, expect, it } from 'vitest';
import { annotationPaths, baseName, exportFileName, findImageKey, isImageFile } from './paths';

describe('image paths', () => {
  it('names images for exports', () => {
    expect(exportFileName('https://cdn.example.com/a/b%20c.png?x=1')).toBe('b c.png');
    expect(exportFileName('./trip/img.jpg')).toBe('trip/img.jpg');
    expect(baseName('C:\\data\\img.jpg')).toBe('img.jpg');
    expect(isImageFile('photo.WEBP')).toBe(true);
    expect(isImageFile('data.yaml')).toBe(false);
  });

  it('gives clashing names distinct annotation files', () => {
    const paths = annotationPaths(['a/x.png', 'https://h/x.png', 'x.jpg'], 'labels', 'txt');
    expect([...paths.values()]).toEqual(['labels/a/x.txt', 'labels/x.txt', 'labels/x_2.txt']);
  });

  it('matches references by exact path, path tail, then unique name', () => {
    const keys = ['trip/day1/a.jpg', 'trip/day2/a.jpg', 'trip/b.png'];
    expect(findImageKey('trip/b.png', keys)).toBe('trip/b.png');
    expect(findImageKey('D:\\backup\\trip\\day2\\a.jpg', keys)).toBe('trip/day2/a.jpg');
    expect(findImageKey('b.png', keys)).toBe('trip/b.png');
    expect(findImageKey('a.jpg', keys)).toBeUndefined(); // two candidates: refuse to guess
    expect(findImageKey('day1/a', keys, { ignoreExtension: true })).toBe('trip/day1/a.jpg');
  });
});
