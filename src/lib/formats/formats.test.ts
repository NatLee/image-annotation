// @vitest-environment happy-dom
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import v1Export from '../__fixtures__/v1-export.json';
import { readRecordList, summarize } from '../records';
import type { AnnotationSession, LabelClass } from '@/types';
import { buildExport, type ImportContext, importFiles, type InputFile } from './index';
import { toLegacyExport } from './legacy';
import { parseYamlNames, readYoloLabels } from './yolo';

const NOW = new Date('2026-11-04T09:30:00.000Z');
const classes: LabelClass[] = [
  { name: 'anime_face', color: '#22c55e' },
  { name: 'cat', color: '#f97316' },
];

const records: AnnotationSession[] = [
  {
    session_id: 'session_1',
    image_url: 'samples/scene-01.png',
    original_size: { width: 1280, height: 800 },
    display_size: { width: 640, height: 400 },
    scale_factor: 0.5,
    annotator: 'nat',
    timestamp: '2026-11-04T08:00:00.000Z',
    bounding_boxes: [
      { id: 'a', x: 100, y: 120, width: 200, height: 180, label: 'anime_face' },
      { id: 'b', x: 640, y: 400, width: 320, height: 240, label: 'cat' },
    ],
  },
  {
    session_id: 'session_2',
    image_url: 'https://nekos.best/api/v2/neko/abc-123.png',
    original_size: { width: 1463, height: 2048 },
    display_size: { width: 571, height: 800 },
    scale_factor: 0.39,
    annotator: 'anonymous',
    timestamp: '2026-11-04T08:05:00.000Z',
    bounding_boxes: [{ id: 'c', x: 400, y: 300, width: 600, height: 640, label: 'anime_face' }],
  },
];
const data = summarize(records, NOW.toISOString());

const context = (over: Partial<ImportContext> = {}): ImportContext => ({
  images: records.map((r) => ({ key: r.image_url, size: r.original_size })),
  classNames: classes.map((c) => c.name),
  now: NOW,
  parseXml: (xml) => new DOMParser().parseFromString(xml, 'application/xml'),
  ...over,
});

const file = (path: string, text: string): InputFile => ({ path, bytes: strToU8(text) });
const unzip = (bytes: Uint8Array) =>
  Object.fromEntries(Object.entries(unzipSync(bytes)).map(([path, b]) => [path, strFromU8(b)]));

/** Boxes without the ids, which are regenerated on import. */
const shape = (list: AnnotationSession[]) =>
  list.map((r) => ({ image_url: r.image_url, size: r.original_size, boxes: r.bounding_boxes.map(({ id: _id, ...rest }) => rest) }));

describe('JSON (v1 format)', () => {
  it('exports exactly the v1 fields', () => {
    const out = buildExport('json', data, classes, NOW);
    expect(out.fileName).toBe('all_annotations_2026-11-04.json');
    const json = JSON.parse(strFromU8(out.bytes));
    expect(Object.keys(json)).toEqual(['export_info', 'annotation_records']);
    expect(json.export_info).toEqual({
      export_date: '2026-11-04T09:30:00.000Z',
      total_images: 2,
      total_annotations: 3,
      data_range: { first_annotation: '2026-11-04T08:00:00.000Z', last_annotation: '2026-11-04T08:05:00.000Z' },
    });
    expect(json.annotation_records).toEqual(records);
  });

  it('reproduces a real v1 export from the same records', () => {
    const v1Records = readRecordList(v1Export, NOW.toISOString())!;
    const again = toLegacyExport(summarize(v1Records, ''), v1Export.export_info.export_date);
    expect(again).toEqual(v1Export);
  });

  it('imports a v1 export unchanged, even for images that are not open', () => {
    const result = importFiles([file('old.json', JSON.stringify(v1Export))], context());
    expect(result.formats).toEqual(['JSON']);
    expect(result.records).toEqual(v1Export.annotation_records);
  });
});

describe('COCO', () => {
  it('writes categories from the class list with ids from 1', () => {
    const coco = JSON.parse(strFromU8(buildExport('coco', data, classes, NOW).bytes));
    expect(coco.categories).toEqual([
      { id: 1, name: 'anime_face', supercategory: '' },
      { id: 2, name: 'cat', supercategory: '' },
    ]);
    expect(coco.images[0]).toMatchObject({ id: 1, file_name: 'samples/scene-01.png', width: 1280, height: 800 });
    expect(coco.images[1]).toMatchObject({ file_name: 'abc-123.png', coco_url: records[1].image_url });
    expect(coco.annotations[1]).toEqual({
      id: 2,
      image_id: 1,
      category_id: 2,
      bbox: [640, 400, 320, 240],
      area: 76800,
      iscrowd: 0,
      segmentation: [],
    });
  });

  it('round-trips', () => {
    const out = buildExport('coco', data, classes, NOW);
    const result = importFiles([{ path: out.fileName, bytes: out.bytes }], context());
    expect(result.formats).toEqual(['COCO']);
    expect(shape(result.records)).toEqual(shape(records));
    expect(result.records[0].annotator).toBe('nat');
  });
});

describe('YOLO', () => {
  it('writes normalised labels, classes.txt and data.yaml', () => {
    const files = unzip(buildExport('yolo', data, classes, NOW).bytes);
    expect(Object.keys(files).sort()).toEqual(['classes.txt', 'data.yaml', 'labels/abc-123.txt', 'labels/samples/scene-01.txt']);
    expect(files['classes.txt']).toBe('anime_face\ncat\n');
    // box a: centre (200, 210) of 1280 x 800, size 200 x 180
    expect(files['labels/samples/scene-01.txt'].split('\n')[0]).toBe('0 0.15625 0.2625 0.15625 0.225');
    expect(parseYamlNames(files['data.yaml'])).toEqual(['anime_face', 'cat']);
  });

  it('round-trips when the images are open', () => {
    const out = buildExport('yolo', data, classes, NOW);
    const result = importFiles([{ path: out.fileName, bytes: out.bytes }], context());
    expect(result.formats).toEqual(['YOLO']);
    expect(shape(result.records)).toEqual(shape(records));
  });

  it('matches dataset folders (images/train ↔ labels/train)', () => {
    const result = importFiles(
      [file('ds/labels/train/img_7.txt', '1 0.5 0.5 0.25 0.5\n'), file('ds/obj.names', 'face\nhand\n')],
      context({ images: [{ key: 'ds/images/train/img_7.jpg', size: { width: 400, height: 200 } }] }),
    );
    expect(result.records).toHaveLength(1);
    expect(result.records[0].image_url).toBe('ds/images/train/img_7.jpg');
    expect(result.records[0].bounding_boxes[0]).toMatchObject({ x: 150, y: 50, width: 100, height: 100, label: 'hand' });
  });

  it('reports labels whose image is not in the list', () => {
    const result = importFiles([file('labels/missing.txt', '0 0.5 0.5 0.1 0.1')], context());
    expect(result.records).toEqual([]);
    expect(result.unmatched).toEqual(['missing']);
  });

  it('turns segmentation polygons into their bounding box', () => {
    const [box] = readYoloLabels('0 0.1 0.2 0.5 0.2 0.5 0.6 0.1 0.6', { width: 100, height: 100 }, ['face']);
    expect(box).toMatchObject({ x: 10, y: 20, width: 40, height: 40, label: 'face' });
  });

  it('reads the common data.yaml shapes', () => {
    expect(parseYamlNames("names: ['a', \"b\", c]\n")).toEqual(['a', 'b', 'c']);
    expect(parseYamlNames('path: x\nnames:\n  - a\n  - b\nnc: 2\n')).toEqual(['a', 'b']);
    expect(parseYamlNames('names:\n  0: person\n  1: "traffic light"\n')).toEqual(['person', 'traffic light']);
    expect(parseYamlNames('names: {0: a, 1: b}')).toEqual(['a', 'b']);
    expect(parseYamlNames('nc: 3')).toBeUndefined();
  });
});

describe('Pascal VOC', () => {
  it('writes one XML per image with VOC corners', () => {
    const files = unzip(buildExport('voc', data, classes, NOW).bytes);
    const xml = files['Annotations/samples/scene-01.xml'];
    expect(xml).toContain('<filename>scene-01.png</filename>');
    expect(xml).toContain('<folder>samples</folder>');
    expect(xml).toContain('<xmin>640</xmin>');
    expect(xml).toContain('<xmax>960</xmax>');
  });

  it('round-trips', () => {
    const out = buildExport('voc', data, classes, NOW);
    const result = importFiles([{ path: out.fileName, bytes: out.bytes }], context());
    expect(result.formats).toEqual(['Pascal VOC']);
    expect(shape(result.records)).toEqual(shape(records));
  });

  it('matches LabelImg files that carry an absolute Windows path', () => {
    const xml = `<annotation><folder>pics</folder><filename>scene-01.png</filename>
      <path>C:\\Users\\me\\pics\\scene-01.png</path><size><width>1280</width><height>800</height><depth>3</depth></size>
      <object><name>anime_face</name><bndbox><xmin>1</xmin><ymin>2</ymin><xmax>11</xmax><ymax>22</ymax></bndbox></object></annotation>`;
    const result = importFiles([file('scene-01.xml', xml)], context());
    expect(result.records[0].image_url).toBe('samples/scene-01.png');
    expect(result.records[0].bounding_boxes[0]).toMatchObject({ x: 1, y: 2, width: 10, height: 20 });
  });

  it('escapes labels', () => {
    const odd = summarize([{ ...records[0], bounding_boxes: [{ ...records[0].bounding_boxes[0], label: 'a<b & "c"' }] }], '');
    const out = buildExport('voc', odd, classes, NOW);
    const result = importFiles([{ path: out.fileName, bytes: out.bytes }], context());
    expect(result.records[0].bounding_boxes[0].label).toBe('a<b & "c"');
  });
});

describe('import housekeeping', () => {
  it('ignores files that are not annotations and skips images without boxes', () => {
    const emptyCoco = { images: [{ id: 1, file_name: 'x.png', width: 10, height: 10 }], annotations: [], categories: [] };
    const zip = zipSync({ 'README.md': strToU8('hi'), '__MACOSX/._x': strToU8(''), 'notes.txt': strToU8('hello world') });
    const result = importFiles(
      [file('coco.json', JSON.stringify(emptyCoco)), file('broken.json', '{'), { path: 'bundle.zip', bytes: zip }],
      context(),
    );
    expect(result.records).toEqual([]);
    expect(result.skipped).toBe(1);
    expect(result.ignored.sort()).toEqual(['README.md', 'broken.json', 'notes.txt']);
  });
});
