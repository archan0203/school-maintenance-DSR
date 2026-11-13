"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase";

type Building = { id: string; name: string };
type LocationItem = {
  id: string;
  building_id: string;
  floor: string | null;
  room: string | null;
};

export default function NewRequest() {
  const [title, setTitle] = useState("");
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [buildingId, setBuildingId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [extraSpot, setExtraSpot] = useState("");
  const [manualLocation, setManualLocation] = useState("");

  const [detail, setDetail] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const sb = createClient();
      const [{ data: b }, { data: l }] = await Promise.all([
        sb.from("buildings").select("id,name").order("name"),
        sb.from("locations").select("id,building_id,floor,room").order("floor"),
      ]);
      setBuildings(b || []);
      setLocations(l || []);
      if (b && b.length > 0) {
        setBuildingId(b[0].id);
      } else {
        setBuildingId("other");
      }
    })();
  }, []);

  const filteredLocations = locations.filter((l) => l.building_id === buildingId);

  function buildLocationText(): string {
    if (buildingId === "other" || buildings.length === 0) {
      return manualLocation.trim();
    }
    const bName = buildings.find((b) => b.id === buildingId)?.name || "";
    const loc = filteredLocations.find((l) => l.id === locationId);
    const locText = loc ? [loc.floor, loc.room].filter(Boolean).join(" ") : "";
    return [bName, locText, extraSpot.trim()].filter(Boolean).join(" · ");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const locationText = buildLocationText();
    if (!locationText) {
      setError("กรุณาระบุสถานที่ที่ชำรุด");
      setBusy(false);
      return;
    }

    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data: row, error: insertError } = await sb
      .from("repair_requests")
      .insert({
        reporter_id: user.id,
        title: title.trim(),
        location_text: locationText,
        description: detail.trim(),
      })
      .select("id")
      .single();

    if (insertError || !row) {
      setError(insertError?.message || "บันทึกไม่สำเร็จ");
      setBusy(false);
      return;
    }

    if (file) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${row.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await sb.storage
        .from("repair-images")
        .upload(path, file, { upsert: false });
      if (!upErr) {
        await sb.from("repair_images").insert({
          request_id: row.id,
          storage_path: path,
          kind: "before",
          uploaded_by: user.id,
        });
      } else {
        setError("บันทึกรายการแล้ว แต่แนบรูปไม่สำเร็จ: " + upErr.message);
      }
    }

    router.push(`/requests/${row.id}`);
    router.refresh();
  }

  return (
    <main className="shell">
      <Nav />
      <div className="card form">
        <h1>แจ้งซ่อมรายการใหม่</h1>
        <p className="muted">กรุณาระบุจุดที่ชำรุดและรายละเอียดให้ชัดเจน</p>
        <form onSubmit={submit}>
          <label>หัวข้อแจ้งซ่อม *</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="เช่น หลอดไฟไม่ติด, ก๊อกน้ำรั่ว"
          />

          {buildings.length > 0 ? (
            <>
              <label>อาคาร / สถานที่หลัก *</label>
              <select
                value={buildingId}
                onChange={(e) => {
                  setBuildingId(e.target.value);
                  setLocationId("");
                }}
              >
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
                <option value="other">อื่นๆ (ระบุสถานที่เอง)</option>
              </select>

              {buildingId === "other" ? (
                <>
                  <label>ระบุสถานที่ *</label>
                  <input
                    required
                    value={manualLocation}
                    onChange={(e) => setManualLocation(e.target.value)}
                    placeholder="เช่น สนามฟุตบอล, ป้อมยามหน้าโรงเรียน"
                  />
                </>
              ) : (
                <div className="grid2">
                  <div>
                    <label>ชั้น / ห้อง</label>
                    <select
                      value={locationId}
                      onChange={(e) => setLocationId(e.target.value)}
                    >
                      <option value="">-- ไม่ระบุห้อง / พื้นที่ส่วนกลาง --</option>
                      {filteredLocations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {[l.floor, l.room].filter(Boolean).join(" ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>จุดที่พบปัญหาเพิ่มเติม (ถ้ามี)</label>
                    <input
                      value={extraSpot}
                      onChange={(e) => setExtraSpot(e.target.value)}
                      placeholder="เช่น หน้าประตู, โซนด้านหลัง"
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <label>สถานที่ *</label>
              <input
                required
                value={manualLocation}
                onChange={(e) => setManualLocation(e.target.value)}
                placeholder="เช่น อาคาร 1 ชั้น 2 ห้อง 201"
              />
            </>
          )}

          <label>รายละเอียดปัญหา *</label>
          <textarea
            required
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="อธิบายอาการชำรุด..."
          />

          <label>รูปภาพจุดที่ชำรุด (ก่อนซ่อม)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />

          {error && <div className="notice error">{error}</div>}
          <button
            className="btn primary"
            disabled={busy}
            style={{ marginTop: 16 }}
          >
            {busy ? "กำลังบันทึก..." : "ส่งรายการแจ้งซ่อม"}
          </button>
        </form>
      </div>
    </main>
  );
}
