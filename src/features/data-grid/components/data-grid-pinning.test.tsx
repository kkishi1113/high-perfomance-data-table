import { render, screen } from '@testing-library/react';
import { DataGrid } from './data-grid';
import { describe, it, expect } from 'vitest';
import type { ColumnDefSimple } from '../types';

// Mock Worker and other browser APIs
class MockWorker {
    terminate() { }
    addEventListener() { }
    removeEventListener() { }
    postMessage() { }
}
(globalThis as any).Worker = MockWorker;

(globalThis as any).ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};

// Mock getBoundingClientRect
Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
        width: 800,
        height: 600,
        top: 0,
        left: 0,
        bottom: 600,
        right: 800,
        x: 0,
        y: 0,
        toJSON: () => { },
    }),
});

describe('DataGrid Row Pinning', () => {
    type TestData = { id: string; name: string };
    const columns: ColumnDefSimple<TestData>[] = [
        { id: 'id', header: 'ID', accessorKey: 'id', width: 50 },
        { id: 'name', header: 'Name', accessorKey: 'name', width: 100 },
    ];

    const data = [
        { id: '1', name: 'Row 1' },
        { id: '2', name: 'Row 2' },
        { id: '3', name: 'Row 3' },
    ];

    it('should offset pinned rows by header height', () => {
        const headerHeight = 50;
        const rowHeight = 40;

        render(
            <DataGrid
                columns={columns}
                data={data}
                headerHeight={headerHeight}
                rowHeight={rowHeight}
            />
        );

        // 行のピン留めを設定 (DataGrid内部で初期値として設定されているが、ここではprops経由で制御できないため
        // 内部実装に依存せず、レンダリングされた結果を検証する)
        // 現在のDataGrid実装では、rowPinningの初期値がハードコードされている:
        // top: ["3", "5", "7"], bottom: ["6", "8", "10"]
        // テストデータにこれらのIDが含まれていないため、ピン留め行が表示されない可能性がある。
        // しかし、DataGridコンポーネントはrowPinningをpropsとして受け取っていないため、
        // テストのためにデータを合わせる必要がある。

        // 修正: DataGridの初期stateに依存するテストは脆いため、
        // 本来はpropsでinitialStateを渡せるようにすべきだが、
        // 現状のインターフェースに合わせてデータを調整する。

        const pinnedData = [
            { id: '3', name: 'Pinned Row 3' }, // Top pinned in default state
            { id: '5', name: 'Pinned Row 5' }, // Top pinned in default state
            { id: '4', name: 'Normal Row 4' },
        ];

        render(
            <DataGrid
                columns={columns}
                data={pinnedData}
                headerHeight={headerHeight}
                rowHeight={rowHeight}
            />
        );

        // ピン留めされた行(ID: 3)を取得
        const pinnedRow = screen.getByText('Pinned Row 3').closest('div[class*="sticky"]');
        expect(pinnedRow).toBeInTheDocument();

        // スタイルを確認
        // 期待値: top: headerHeight (50px)
        // 現状(バグ): top: 0px (または undefined/default)

        // Note: style.topは文字列で返ってくる
        const style = window.getComputedStyle(pinnedRow as Element);
        // JSDOMではstyle属性が反映されるので、直接styleプロパティを見る
        const actualTop = (pinnedRow as HTMLElement).style.top;
        if (actualTop !== `${headerHeight}px`) {
            throw new Error(`Expected ${headerHeight}px but got "${actualTop}"`);
        }
        expect((pinnedRow as HTMLElement).style.top).toBe(`${headerHeight}px`);
    });
});
