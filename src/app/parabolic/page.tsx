'use client';
import { useState, useEffect, useCallback } from 'react';
import type { ParabolicCase, ParabolicCaseInput } from '@/types/parabolic';
import ParabolicCaseForm from '@/components/ParabolicCaseForm';
import ParabolicCaseCard from '@/components/ParabolicCaseCard';
import LoadingDots from '@/components/LoadingDots';

export default function ParabolicPage() {
  const [cases, setCases] = useState<ParabolicCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/parabolic');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ParabolicCase[] = await res.json();
      setCases(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleCreate(data: ParabolicCaseInput) {
    const res = await fetch('/api/parabolic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    await load();
  }

  async function handleDelete(id: string) {
    const prev = cases;
    setCases((cur) => cur.filter((c) => c.id !== id));
    const res = await fetch(`/api/parabolic/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setCases(prev);
      setError('삭제에 실패했습니다.');
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch('/api/parabolic/export');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `parabolic_cases_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('엑셀 내보내기에 실패했습니다.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-3 sm:py-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">파라볼릭 펌핑 리서치</h1>
          <p className="text-xs text-gray-600 mt-0.5">
            코인·시간봉을 고르고 차트를 클릭해 L0~R1(+L4) 구조를 표시하면, 구간별 변동률·기간·거래량을
            자동 계산해 저장합니다.
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || cases.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600
                     disabled:opacity-40 disabled:cursor-not-allowed
                     text-white text-sm font-semibold transition-colors shadow-sm shrink-0"
        >
          {exporting ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              내보내는 중...
            </>
          ) : (
            <>엑셀 다운로드</>
          )}
        </button>
      </div>

      <ParabolicCaseForm onSubmit={handleCreate} />

      {error && (
        <div className="bg-red-900/20 border border-red-800/50 rounded-xl px-4 py-3 text-red-400 text-sm">
          ⚠ {error}
        </div>
      )}

      {loading ? (
        <div className="bg-[#111827] rounded-xl border border-[#1F2937] px-4 py-8 text-center space-y-2">
          <div className="flex justify-center">
            <LoadingDots />
          </div>
          <p className="text-sm text-gray-500">사례를 불러오는 중입니다...</p>
        </div>
      ) : cases.length === 0 ? (
        <div className="bg-[#111827] rounded-xl border border-[#1F2937] px-4 py-12 text-center text-gray-600 text-sm">
          아직 저장된 사례가 없습니다. 위에서 첫 파라볼릭 구조를 기록해보세요.
        </div>
      ) : (
        <div className="space-y-2.5">
          {cases.map((c) => (
            <ParabolicCaseCard key={c.id} item={c} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </main>
  );
}
