"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase";

type ReportRow = {
  id: string;
  request_no: number;
  title: string;
  location_text: string;
  status: string;
  created_at: string;
  cost: number;
};

export default function Reports() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [rows, setRows] = useState<ReportRow[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState("ทั้งหมด");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    (async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: p } = await sb
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!["admin", "technician"].includes(p?.role || "")) {
        setAuthorized(false);
        return;
      }
      setAuthorized(true);

      const [{ data: reqs }, { data: updates }] = await Promise.all([
        sb
          .from("repair_requests")
          .select("id,request_no,title,location_text,status,created_at")
          .order("created_at", { ascending: false }),
        sb.from("repair_updates").select("request_id,total_cost"),
      ]);

      const costMap: Record<string, number> = {};
      (updates || []).forEach((u: any) => {
        costMap[u.request_id] = (costMap[u.request_id] || 0) + Number(u.total_cost || 0);
      });

      const merged: ReportRow[] = (reqs || []).map((r: any) => ({
        ...r,
        cost: costMap[r.id] || 0,
      }));
      setRows(merged);
    })();
  }, [router]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "ทั้งหมด" && r.status !== statusFilter) return false;
      const d = r.created_at.slice(0, 10);
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      if (keyword.trim()) {
        const q = keyword.trim().toLowerCase();
        const match =
          String(r.request_no).includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.location_text.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [rows, statusFilter, startDate, endDate, keyword]);

  const totalCost = useMemo(
    () => filtered.reduce((sum, r) => sum + r.cost, 0),
    [filtered]
  );

  const completedCount = useMemo(
    () => filtered.filter((r) => r.status === "เสร็จสิ้น").length,
    [filtered]
  );

  function exportCSV() {
    const headers = ["เลขที่", "รายการแจ้งซ่อม", "สถานที่", "สถานะ", "วันที่แจ้ง", "ค่าใช้จ่ายรวม (บาท)"];
    const escapeCell = (val: string | number) =>
      `"${String(val).replace(/"/g, '""')}"`;

    const lines = [
      headers.map(escapeCell).join(","),
      ...filtered.map((r) =>
        [
          r.request_no,
          r.title,
          r.location_text,
          r.status,
          new Date(r.created_at).toLocaleDateString("th-TH"),
          r.cost.toFixed(2),
        ]
          .map(escapeCell)
          .join(",")
      ),
    ];

    const csvContent = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `school-maintenance-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (authorized === null) {
    return (
      <main className="shell">
        <Nav />
        <div className="card">กำลังโหลดข้อมูลรายงาน...</div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="shell">
        <Nav />
        <div className="card">ไม่มีสิทธิ์เข้าถึงรายงาน</div>
      </main>
    );
  }

  return (
    <main className="shell">
      <Nav />
      <div className="stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h1>รายงานสรุปงานซ่อมและงบประมาณ</h1>
            <div className="muted">กรองข้อมูลตามช่วงเวลาและส่งออกเป็นไฟล์ Excel (CSV)</div>
          </div>
          <button
            type="button"
            className="btn primary"
            onClick={exportCSV}
            disabled={filtered.length === 0}
          >
            📥 ดาวน์โหลดรายงาน (Excel / CSV)
          </button>
        </div>

        {/* ตัวกรองรายงาน */}
        <div className="card">
          <div className="grid">
            <div>
              <label style={{ marginTop: 0 }}>สถานะ</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option>ทั้งหมด</option>
                <option>รอตรวจสอบ</option>
                <option>รอดำเนินการ</option>
                <option>กำลังดำเนินการ</option>
                <option>เสร็จสิ้น</option>
                <option>ยกเลิก</option>
              </select>
            </div>
            <div>
              <label style={{ marginTop: 0 }}>ตั้งแต่วันที่</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label style={{ marginTop: 0 }}>ถึงวันที่</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div>
              <label style={{ marginTop: 0 }}>ค้นหา</label>
              <input
                placeholder="เลขที่ / หัวข้อ / สถานที่"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
          </div>
          {(statusFilter !== "ทั้งหมด" || startDate || endDate || keyword) && (
            <button
              type="button"
              className="btn"
              style={{ marginTop: 12 }}
              onClick={() => {
                setStatusFilter("ทั้งหมด");
                setStartDate("");
                setEndDate("");
                setKeyword("");
              }}
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>

        {/* สรุปตัวเลขตามตัวกรอง */}
        <div className="grid2">
          <div className="card">
            <div className="muted">จำนวนงานซ่อม (เสร็จสิ้น {completedCount} รายการ)</div>
            <div className="stat">{filtered.length} รายการ</div>
          </div>
          <div className="card">
            <div className="muted">ค่าใช้จ่ายรวมตามรายการที่แสดง</div>
            <div className="stat">{totalCost.toLocaleString("th-TH")} ฿</div>
          </div>
        </div>

        {/* ตารางรายงาน */}
        <div className="card">
          <h2>ประวัติงานซ่อม</h2>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>เลขที่</th>
                  <th>รายการ</th>
                  <th>สถานที่</th>
                  <th>สถานะ</th>
                  <th>วันที่แจ้ง</th>
                  <th>ค่าใช้จ่าย (บาท)</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/requests/${r.id}`} style={{ color: "#1d4ed8", fontWeight: 600 }}>
                        #{r.request_no}
                      </Link>
                    </td>
                    <td>{r.title}</td>
                    <td>{r.location_text}</td>
                    <td><span className="badge">{r.status}</span></td>
                    <td>{new Date(r.created_at).toLocaleDateString("th-TH")}</td>
                    <td>{r.cost.toLocaleString("th-TH")} ฿</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <p className="muted">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</p>}
          </div>
        </div>
      </div>
    </main>
  );
}
