"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase";

type Req = {
  id: string;
  request_no: string;
  title: string;
  location_text: string;
  description: string;
  status: string;
  reporter_id: string;
  created_at: string;
};

type UpdateLog = {
  id: string;
  details: string;
  material_quantity: number;
  unit_price: number;
  labor_cost: number;
  total_cost: number;
  created_at: string;
};

export default function Detail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<Req | null>(null);
  const [role, setRole] = useState("");
  const [worker, setWorker] = useState("");
  const [assignedName, setAssignedName] = useState("");
  const [workers, setWorkers] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [qty, setQty] = useState("0");
  const [price, setPrice] = useState("0");
  const [labor, setLabor] = useState("0");
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<any[]>([]);
  const [updates, setUpdates] = useState<UpdateLog[]>([]);

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
    setRole(p?.role || "");

    const { data: r } = await sb
      .from("repair_requests")
      .select("*")
      .eq("id", id)
      .single();
    if (!r) {
      setMessage("ไม่พบรายการ");
      return;
    }
    setRow(r);

    const { data: a } = await sb
      .from("assignments")
      .select("technician_id,profiles:technician_id(full_name)")
      .eq("request_id", id)
      .maybeSingle();
    setWorker(a?.technician_id || "");
    setAssignedName((a?.profiles as any)?.full_name || "");

    const { data: t } = await sb
      .from("profiles")
      .select("id,full_name")
      .eq("role", "technician");
    setWorkers(t || []);

    const { data: im } = await sb
      .from("repair_images")
      .select("*")
      .eq("request_id", id)
      .order("created_at", { ascending: true });

    const withUrls = await Promise.all(
      (im || []).map(async (x: any) => {
        const { data: u } = await sb.storage
          .from("repair-images")
          .createSignedUrl(x.storage_path, 3600);
        return { ...x, url: u?.signedUrl || "" };
      })
    );
    setImages(withUrls);

    const { data: up } = await sb
      .from("repair_updates")
      .select("*")
      .eq("request_id", id)
      .order("created_at", { ascending: false });
    setUpdates((up as UpdateLog[]) || []);
  }

  useEffect(() => {
    load();
  }, [id]);

  async function assign() {
    if (!worker) {
      setMessage("กรุณาเลือกช่างก่อนบันทึก");
      return;
    }
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    const { error } = await sb.from("assignments").upsert(
      {
        request_id: id,
        technician_id: worker,
        assigned_by: user?.id,
      },
      { onConflict: "request_id" }
    );
    setMessage(error?.message || "มอบหมายงานให้ช่างเรียบร้อยแล้ว");
    await load();
  }

  async function update() {
    setBusy(true);
    setMessage("");
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();

    const { error: e1 } = await sb
      .from("repair_requests")
      .update({ status: row?.status, updated_at: new Date().toISOString() })
      .eq("id", id);

    const { error: e2 } = await sb.from("repair_updates").insert({
      request_id: id,
      updated_by: user?.id,
      details: note,
      material_quantity: Number(qty),
      unit_price: Number(price),
      labor_cost: Number(labor),
      total_cost: Number(qty) * Number(price) + Number(labor),
    });

    let imgMsg = "";
    if (afterFile && user) {
      const ext = afterFile.name.split(".").pop() || "jpg";
      const path = `${id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await sb.storage
        .from("repair-images")
        .upload(path, afterFile, { upsert: false });
      if (!upErr) {
        await sb.from("repair_images").insert({
          request_id: id,
          storage_path: path,
          kind: "after",
          uploaded_by: user.id,
        });
        setAfterFile(null);
      } else {
        imgMsg = " (อัปโหลดรูปหลังซ่อมไม่สำเร็จ: " + upErr.message + ")";
      }
    }

    setMessage((e1?.message || e2?.message || "บันทึกผลการซ่อมเรียบร้อยแล้ว") + imgMsg);
    setNote("");
    setQty("0");
    setPrice("0");
    setLabor("0");
    setBusy(false);
    await load();
  }

  async function deleteRequest() {
    if (!row) return;
    if (
      !confirm(
        `ยืนยันการลบรายการแจ้งซ่อมเลขที่ ${row.request_no} (${row.title})?\nข้อมูลการซ่อมและรูปภาพทั้งหมดจะถูกลบถาวร`
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage("");
    const sb = createClient();

    if (images.length > 0) {
      const paths = images.map((im) => im.storage_path).filter(Boolean);
      if (paths.length > 0) {
        await sb.storage.from("repair-images").remove(paths);
      }
    }

    const { error } = await sb.from("repair_requests").delete().eq("id", id);
    if (error) {
      setMessage("ลบรายการไม่สำเร็จ: " + error.message);
      setBusy(false);
      return;
    }

    router.push("/requests");
    router.refresh();
  }

  function badgeClass(status: string) {
    if (status === "เสร็จสิ้น") return "badge b-green";
    if (status === "กำลังดำเนินการ") return "badge b-blue";
    if (status === "ยกเลิก") return "badge b-gray";
    return "badge";
  }

  if (!row) {
    return (
      <main className="shell">
        <Nav />
        <div className="card">{message || "กำลังโหลด..."}</div>
      </main>
    );
  }

  return (
    <main className="shell">
      <Nav />
      <div className="stack">
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div className="muted">
                เลขที่ {row.request_no} · แจ้งเมื่อ{" "}
                {new Date(row.created_at).toLocaleString("th-TH")}
              </div>
              <h1>{row.title}</h1>
            </div>
            {role === "admin" && (
              <button
                type="button"
                className="btn"
                style={{ background: "#fee2e2", color: "#991b1b" }}
                disabled={busy}
                onClick={deleteRequest}
              >
                🗑️ ลบรายการแจ้งซ่อม
              </button>
            )}
          </div>
          <p><b>สถานที่:</b> {row.location_text}</p>
          <p><b>รายละเอียด:</b> {row.description}</p>
          <p>
            <b>สถานะ:</b> <span className={badgeClass(row.status)}>{row.status}</span>
          </p>
          {assignedName && (
            <p><b>ช่างผู้รับผิดชอบ:</b> {assignedName}</p>
          )}
        </div>

        {images.length > 0 && (
          <div className="card">
            <h2>รูปภาพประกอบ (ก่อนซ่อม / หลังซ่อม)</h2>
            <div className="grid2">
              {images.map((i) => (
                <div key={i.id}>
                  <div style={{ marginBottom: 6 }}>
                    <span className={`badge ${i.kind === "after" ? "b-green" : ""}`}>
                      {i.kind === "before" ? "ภาพก่อนซ่อม" : "ภาพหลังซ่อม"}
                    </span>
                  </div>
                  {i.url ? (
                    <img
                      src={i.url}
                      alt="ภาพประกอบงานซ่อม"
                      style={{
                        width: "100%",
                        maxHeight: 320,
                        objectFit: "cover",
                        borderRadius: 10,
                        border: "1px solid #e5eaf1",
                      }}
                    />
                  ) : (
                    <p className="muted">ไม่สามารถแสดงภาพได้</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {role === "admin" && (
          <div className="card">
            <h2>มอบหมายงานให้ช่าง</h2>
            {workers.length === 0 ? (
              <p className="muted">
                ยังไม่มีบัญชีช่างในระบบ กรุณาไปที่เมนู <b>จัดการระบบ (Admin)</b> เพื่อกำหนดสิทธิ์ผู้ใช้เป็น <b>technician</b> ก่อน
              </p>
            ) : (
              <div className="row">
                <select
                  style={{ maxWidth: 340 }}
                  value={worker}
                  onChange={(e) => setWorker(e.target.value)}
                >
                  <option value="">-- เลือกช่าง --</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>{w.full_name || w.id}</option>
                  ))}
                </select>
                <button className="btn primary" onClick={assign}>
                  บันทึกการมอบหมาย
                </button>
              </div>
            )}
          </div>
        )}

        {(role === "admin" || role === "technician") && (
          <div className="card">
            <h2>บันทึกผลและสถานะการซ่อม</h2>
            <label>สถานะงานซ่อม</label>
            <select
              value={row.status}
              onChange={(e) => setRow({ ...row, status: e.target.value })}
            >
              <option>รอตรวจสอบ</option>
              <option>รอดำเนินการ</option>
              <option>กำลังดำเนินการ</option>
              <option>เสร็จสิ้น</option>
              <option>ยกเลิก</option>
            </select>

            <label>รายละเอียดวิธีแก้ไข / หมายเหตุ</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น เปลี่ยนหลอด LED 18W จำนวน 2 หลอด เรียบร้อยแล้ว"
            />

            <label>แนบรูปภาพหลังซ่อม (ถ้ามี)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setAfterFile(e.target.files?.[0] || null)}
            />

            <div className="grid2">
              <div>
                <label>จำนวนวัสดุ</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </div>
              <div>
                <label>ราคาต่อหน่วย (บาท)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div>
                <label>ค่าแรง (บาท)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={labor}
                  onChange={(e) => setLabor(e.target.value)}
                />
              </div>
              <div>
                <label>ค่าใช้จ่ายรวมรอบนี้ (บาท)</label>
                <input
                  readOnly
                  style={{ background: "#f8fafc", fontWeight: 600 }}
                  value={(Number(qty) * Number(price) + Number(labor)).toFixed(2)}
                />
              </div>
            </div>

            <button
              className="btn primary"
              style={{ marginTop: 14 }}
              disabled={busy}
              onClick={update}
            >
              {busy ? "กำลังบันทึก..." : "บันทึกผลการซ่อม"}
            </button>
          </div>
        )}

        {message && <div className="notice">{message}</div>}

        <div className="card">
          <h2>ประวัติการดำเนินการและค่าใช้จ่าย</h2>
          {updates.length === 0 ? (
            <p className="muted">ยังไม่มีประวัติการบันทึกผลซ่อม</p>
          ) : (
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>วัน-เวลา</th>
                    <th>รายละเอียดการซ่อม</th>
                    <th>ค่าวัสดุ</th>
                    <th>ค่าแรง</th>
                    <th>รวม (บาท)</th>
                  </tr>
                </thead>
                <tbody>
                  {updates.map((u) => (
                    <tr key={u.id}>
                      <td>{new Date(u.created_at).toLocaleString("th-TH")}</td>
                      <td>{u.details || "-"}</td>
                      <td>
                        {Number(u.material_quantity)} × {Number(u.unit_price).toLocaleString("th-TH")}
                      </td>
                      <td>{Number(u.labor_cost).toLocaleString("th-TH")}</td>
                      <td><b>{Number(u.total_cost).toLocaleString("th-TH")} ฿</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
