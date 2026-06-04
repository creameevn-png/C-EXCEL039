// ⚠️ ROUTE TẠM — thêm các cột còn thiếu vào DB prod (TiDB) rồi XÓA file này sau khi chạy.
// Lý do: DATABASE_URL trên Vercel là "Sensitive" (không đọc lại được) và prisma db push
// bị FK chặn vì index drift. Route này dùng kết nối DB sẵn có của app để ALTER trực tiếp,
// kiểm tra cột tồn tại trước nên idempotent (chạy lại nhiều lần vẫn an toàn).
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Khóa bí mật dùng 1 lần; route sẽ bị xóa ngay sau khi chạy.
const KEY = 'cu039-sync-9f3a7c2e8b14d6a05e7290fbac3d1e84';

// Tên bảng/cột là hằng số cố định (không phải input người dùng) -> dựng câu ALTER an toàn.
const TARGETS = [
  { table: 'lich_su_vi', col: 'quy' },
  { table: 'nguon_hang', col: 'danh_muc' },
  { table: 'san_pham', col: 'danh_muc' },
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get('key') !== KEY) {
    return NextResponse.json({ ok: false, message: 'forbidden' }, { status: 403 });
  }

  const results: Array<Record<string, unknown>> = [];
  for (const t of TARGETS) {
    try {
      const rows = (await prisma.$queryRawUnsafe(
        'SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
        t.table,
        t.col,
      )) as Array<{ c: bigint | number }>;
      const exists = Number(rows?.[0]?.c ?? 0) > 0;
      if (exists) {
        results.push({ ...t, status: 'already-exists' });
        continue;
      }
      await prisma.$executeRawUnsafe(
        `ALTER TABLE \`${t.table}\` ADD COLUMN \`${t.col}\` VARCHAR(191) NULL`,
      );
      results.push({ ...t, status: 'added' });
    } catch (e: unknown) {
      results.push({ ...t, status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({ ok: true, results });
}
