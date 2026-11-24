// 一个 JSON 文件就够了：24 格礼物 + 几十条事件。整个读进内存，改完整个写回（先写临时文件再改名，断电也不会写坏）。
// One JSON file is plenty for 24 gifts. Written atomically (tmp file + rename).
import fs from 'node:fs';
import path from 'node:path';

export class Store {
  constructor(file) {
    this.file = file;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { gifts: [], events: [] };
    this.data.gifts ||= []; this.data.events ||= [];
  }
  save() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 1));
    fs.renameSync(tmp, this.file);
  }
}
