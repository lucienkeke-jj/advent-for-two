// 一個 JSON 檔案就夠了：24 格禮物 + 幾十條事件。整個讀進記憶體，改完整個寫回（先寫臨時檔案再改名，斷電也不會寫壞）。
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
