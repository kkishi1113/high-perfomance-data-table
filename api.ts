// --- api.ts (サーバーサイドの代わり) ---

const TOTAL_ROWS = 100000;
const TOTAL_COLS = 200;
const PAGE_SIZE = 50; // 1回のリクエストで取得する行数

// 遅延をシミュレートするユーティリティ
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type DataPage = {
  rows: Record<string, string | number>[];
  pageIndex: number;
};

// 指定されたページ番号（0, 1, 2...）のデータを返すAPI
export const fetchUserPage = async (pageIndex: number): Promise<DataPage> => {
  await delay(500); // ネットワーク遅延の再現

  const startRow = pageIndex * PAGE_SIZE;
  const endRow = Math.min(startRow + PAGE_SIZE, TOTAL_ROWS);

  const rows: Record<string, string | number>[] = [];
  for (let i = startRow; i < endRow; i++) {
    const row: Record<string, string | number> = {
      id: i.toString(),
      name: `User ${i}`,
    };
    // カラム2〜200のデータを生成
    for (let j = 2; j < TOTAL_COLS; j++) {
      row[`col${j}`] = `Val ${i}-${j}`;
    }
    rows.push(row);
  }

  return { rows, pageIndex };
};
