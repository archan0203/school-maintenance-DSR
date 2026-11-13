"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase";

type RequestItem = {
  id: string;
  request_no: string;
  title: string;
  location_text: string;
  status: string;
  created_at: string;
  profiles?: { full_name: string } | null;
};

export default function Requests() {
  const router = useRouter();
  const [rows, setRows] = useState<RequestItem[]>([]);
  const [role, setRole] = useState("");
  const [statusFilter, setStatusFilter] = useState("ทั้งหมด");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function load() {
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
    setRole(p?.role || "staff");

    const { data } = await sb
      .from("repair_requests")
      .select("id,request_no,title,location_text,status,created_at,profiles!repair_requests_reporter_id_fkey(full_name)")
      .order("created_at", { ascending: false });

    setRows((data as unknown as RequestItem[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "ทั้งหมด" && r.status !== statusFilter) return false;
      if (keyword.trim()) {
        const q = keyword.trim().toLowerCase();
        const match =
          (r.request_no || "").toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.location_text.toLowerCase().includes(q) ||
          (r.profiles?.full_name || "").toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [rows, statusFilter, keyword]);

  async function handleDelete(item: RequestItem) {
    if (
      !confirm(
        `ยืนยันการลบรายการเลขที่ ${item.request_no} (${item.title})?\nข้อมูลและรูปภาพที่เกี่ยวข้องจะถูกลบถาวร`
      )
    ) {
      return;
    }
    setMsg("");
    setErr("");
    const sb = createClient();

    const { data: im } = await sb
      .from("repair_images")
      .select("storage_path")
      .eq("request_id", item.id);
    if (im && im.length > 0) {
      const paths = im.map((x: any) => x.storage_path).filter(Boolean);
      if (paths.length > 0) {
        await sb.storage.from("repair-images").remove(paths);
      }
    }

    const { error } = await sb.from("repair_requests").delete().eq("id", item.id);
    if (error) {
      setErr("ลบรายการไม่สำเร็จ: " + error.message);
      return;
    }
    setMsg(`ลบรายการเลขที่ ${item.request_no} เรียบร้อยแล้ว`);
    await load();
  }

  function badgeClass(status: string) {
    if (status === "เสร็จสิ้น") return "badge b-green";
    if (status === "กำลังดำเนินการ") return "badge b-blue";
    if (status === "ยกเลิก") return "badge b-gray";
    return "badge";
  }

  return (
    <main className="shell">
      <Nav />
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1>รายการแจ้งซ่อม</h1>
          <Link className="btn primary" href="/requests/new">＋ แจ้งซ่อม</Link>
        </div>

        {msg && <div className="notice">{msg}</div>}
        {err && <div className="notice error">{err}</div>}

        <div className="row" style={{ margin: "12px 0" }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ maxWidth: 220 }}
          >
            <option>ทั้งหมด</option>
            <option>รอตรวจสอบ</option>
            <option>รอดำเนินการ</option>
            <option>กำลังดำเนินการ</option>
            <option>เสร็จสิ้น</option>
            <option>ยกเลิก</option>
          </select>
          <input
            style={{ maxWidth: 320 }}
            placeholder="ค้นหาเลขที่ (เช่น 01-11-2569) / หัวข้อ / สถานที่"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>

        {loading ? (
          <p className="muted">กำลังโหลดรายการ...</p>
        ) : (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>เลขที่</th>
                  <th>หัวข้อ</th>
                  <th>สถานที่</th>
                  <th>ผู้แจ้ง</th>
                  <th>สถานะ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{r.request_no}</td>
                    <td>{r.title}</td>
                    <td>{r.location_text}</td>
                    <td>{r.profiles?.full_name || "-"}</td>
                    <td><span className={badgeClass(r.status)}>{r.status}</span></td>
                    <td>
                      <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                        <Link className="btn" href={`/requests/${r.id}`}>เปิด</Link>
                        {role === "admin" && (
                          <button
                            type="button"
                            className="btn"
                            style={{ background: "#fee2e2", color: "#991b1b" }}
                            onClick={() => handleDelete(r)}
                          >
                            ลบ
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <p className="muted">ไม่พบรายการ</p>}
          </div>
        )}
      </div>
    </main>
  );
}
