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

describe('DataGrid Bottom Row Pinning', () => {
    type TestData = { id: string; name: string };
    const columns: ColumnDefSimple<TestData>[] = [
        { id: 'id', header: 'ID', accessorKey: 'id', width: 50 },
        { id: 'name', header: 'Name', accessorKey: 'name', width: 100 },
    ];

    const data = [
        { id: '1', name: 'Row 1' },
        { id: '2', name: 'Row 2' },
        { id: '3', name: 'Row 3' },
        { id: '4', name: 'Row 4' },
        { id: '5', name: 'Row 5' },
    ];

    it('should stack bottom pinned rows correctly', () => {
        const headerHeight = 50;
        const rowHeight = 40;

        // DataGridの初期stateでは top: ["3", "5", "7"], bottom: ["6", "8", "10"] となっている
        // テストデータをこれに合わせて作成する
        const pinnedData = [
            { id: '1', name: 'Normal Row 1' },
            { id: '6', name: 'Bottom Pinned Row 6' }, // Bottom pinned (index 0 in bottomRows)
            { id: '8', name: 'Bottom Pinned Row 8' }, // Bottom pinned (index 1 in bottomRows)
        ];

        render(
            <DataGrid
                columns={columns}
                data={pinnedData}
                headerHeight={headerHeight}
                rowHeight={rowHeight}
            />
        );

        // Bottom pinned rows
        const row6 = screen.getByText('Bottom Pinned Row 6').closest('div[class*="sticky"]');
        const row8 = screen.getByText('Bottom Pinned Row 8').closest('div[class*="sticky"]');

        expect(row6).toBeInTheDocument();
        expect(row8).toBeInTheDocument();

        // 検証ロジック:
        // bottomRows = [Row 6, Row 8] (順序は実装依存だが、通常は元のデータの順序)
        // Row 6 is first in bottomRows, Row 8 is second.
        // Stacking from bottom:
        // Last row (Row 8) should be at bottom: 0
        // Second to last row (Row 6) should be at bottom: rowHeight (40px)

        // Note: TanStack TableのgetBottomRows()の順序を確認する必要があるが、
        // 通常はデータ順序に従うはず。

        const style6 = (row6 as HTMLElement).style;
        const style8 = (row8 as HTMLElement).style;

        // 現状(バグ)はすべて bottom: 0 になっているはず

        // 期待値:
        // Row 8 (一番下) -> bottom: 0px
        // Row 6 (その上) -> bottom: 40px

        const bottom6 = style6.bottom;
        const bottom8 = style8.bottom;

        // 詳細なエラーメッセージを表示するためにチェック
        console.log('DEBUG: Row 6 bottom:', bottom6);
        console.log('DEBUG: Row 8 bottom:', bottom8);

        if (bottom6 !== '40px') {
            throw new Error(`Row 6: Expected bottom 40px but got "${bottom6}"`);
        }
        if (bottom8 !== '0px') {
            throw new Error(`Row 8: Expected bottom 0px but got "${bottom8}"`);
        }

        expect(bottom6).toBe('40px');
        expect(bottom8).toBe('0px');
    });
});
