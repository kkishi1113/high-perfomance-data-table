/**
 * Web Workerを作成するファクトリー関数
 * ソートとフィルタリング処理を非同期で実行するWorkerを生成します。
 * @returns {Worker} 作成されたWeb Workerインスタンス
 */
export function createWorker() {
  const code = `
    self.onmessage = function(e) {
      const { id, op, payload } = e.data;
      try {
        if(op === 'sort'){
          const { rows, sortBy } = payload;
          // シンプルなアクセサ（直接プロパティアクセスを想定）
          // 実際のシナリオでは、アクセサパスや関数を文字列として渡す必要がある場合があります
          const accessor = (row, key) => row[key];
          
          const sorted = rows.slice().sort((a,b) => {
            for(const s of sortBy){
              const av = accessor(a, s.id);
              const bv = accessor(b, s.id);
              if(av == null && bv == null) continue;
              if(av == null) return s.desc ? 1 : -1;
              if(bv == null) return s.desc ? -1 : 1;
              if(av > bv) return s.desc ? -1 : 1;
              if(av < bv) return s.desc ? 1 : -1;
            }
            return 0;
          });
          postMessage({ id, result: sorted });
        } else if(op === 'filter'){
          const { rows, filters } = payload;
          const accessor = (row, key) => row[key];
          
          const filtered = rows.filter(r => {
            for(const f of filters){
              const v = accessor(r, f.id);
              if(v == null) return false;
              if(String(v).toLowerCase().indexOf(String(f.value).toLowerCase()) === -1) return false;
            }
            return true;
          });
          postMessage({ id, result: filtered });
        }
      } catch (err) {
        postMessage({ id, error: String(err) });
      }
    }
  `;
  const blob = new Blob([code], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);
  return new Worker(url);
}
