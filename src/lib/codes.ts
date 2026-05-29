import { prisma } from './db';

function yymmdd(d = new Date()): string {
  const tz = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const yy = String(tz.getUTCFullYear()).slice(2);
  const mm = String(tz.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(tz.getUTCDate()).padStart(2, '0');
  return yy + mm + dd;
}

export async function nextMaDH(): Promise<string> {
  const prefix = 'DH-' + yymmdd() + '-';
  const last = await prisma.donHang.findFirst({
    where: { maDH: { startsWith: prefix } },
    orderBy: { maDH: 'desc' },
    select: { maDH: true }
  });
  const n = last ? parseInt(last.maDH.slice(prefix.length), 10) + 1 : 1;
  return prefix + String(n).padStart(3, '0');
}

export async function nextMaKH(): Promise<string> {
  const last = await prisma.khachHang.findFirst({
    where: { maKH: { startsWith: 'KH' } },
    orderBy: { maKH: 'desc' },
    select: { maKH: true }
  });
  const n = last ? parseInt(last.maKH.slice(2), 10) + 1 : 1;
  return 'KH' + String(n).padStart(3, '0');
}

export async function nextMaSP(): Promise<string> {
  const last = await prisma.sanPham.findFirst({
    where: { maSP: { startsWith: 'SP' } },
    orderBy: { maSP: 'desc' },
    select: { maSP: true }
  });
  const n = last ? parseInt(last.maSP.slice(2), 10) + 1 : 1;
  return 'SP' + String(n).padStart(3, '0');
}

export async function nextMaKN(): Promise<string> {
  const prefix = 'KN-' + yymmdd() + '-';
  const last = await prisma.khieuNai.findFirst({
    where: { maKN: { startsWith: prefix } },
    orderBy: { maKN: 'desc' },
    select: { maKN: true }
  });
  const n = last ? parseInt(last.maKN.slice(prefix.length), 10) + 1 : 1;
  return prefix + String(n).padStart(3, '0');
}

export async function nextMaYC(): Promise<string> {
  const prefix = 'YC-' + yymmdd() + '-';
  const last = await prisma.yeuCauMua.findFirst({
    where: { maYC: { startsWith: prefix } },
    orderBy: { maYC: 'desc' },
    select: { maYC: true }
  });
  const n = last ? parseInt(last.maYC.slice(prefix.length), 10) + 1 : 1;
  return prefix + String(n).padStart(3, '0');
}

export async function nextMaCT(): Promise<string> {
  const prefix = 'CT-' + yymmdd() + '-';
  const last = await prisma.chungTu.findFirst({
    where: { maCT: { startsWith: prefix } },
    orderBy: { maCT: 'desc' },
    select: { maCT: true }
  });
  const n = last ? parseInt(last.maCT.slice(prefix.length), 10) + 1 : 1;
  return prefix + String(n).padStart(3, '0');
}
