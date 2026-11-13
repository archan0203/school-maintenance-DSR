"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase";

type Building = { id: string; name: string };
type LocationItem = {
  id: string;
  building_id: string;
  floor: string | null;
  room: string | null;
  buildings?: { name: string } | null;
};
type ProfileItem = {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "technician" | "staff";
};

const TITLE_PREFIXES = ["นาย ", "นาง ", "นางสาว ", "ว่าที่ ร.ต. "];

export default function Admin() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);

  // Form states
  const [newBuilding, setNewBuilding] = useState("");
  const [selBuilding, setSelBuilding] = useState("");
  const [newFloor, setNewFloor] = useState("");
  const [newRoom, setNewRoom] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function loadAll() {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    const { data: me } = await sb
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (me?.role !== "admin") {
      setAuthorized(false);
      return;
    }
    setAuthorized(true);

    const [{ data: b }, { data: l }, { data: p }] = await Promise.all([
      sb.from("buildings").select("id,name").order("name"),
      sb
        .from("locations")
        .select("id,building_id,floor,room,buildings(name)")
        .order("floor"),
      sb
        .from("profiles")
        .select("id,full_name,email,role")
        .order("created_at", { ascending: false }),
    ]);

    setBuildings(b || []);
    setLocations((l as unknown as LocationItem[]) || []);
    setProfiles((p as ProfileItem[]) || []);
    if (b && b.length > 0 && !selBuilding) {
      setSelBuilding(b[0].id);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const existingNames = useMemo(() => {
    const set = new Set<string>();
    profiles.forEach((p) => {
      const n = (p.full_name || "").trim();
      if (n) set.add(n);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "th"));
  }, [profiles]);

  async function addBuilding(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setErr("");
    if (!newBuilding.trim()) return;
    const sb = createClient();
    const { error } = await sb
      .from("buildings")
      .insert({ name: newBuilding.trim() });
    if (error) {
      setErr("เพิ่มอาคารไม่สำเร็จ: " + error.message);
      return;
    }
    setNewBuilding("");
    setMsg("เพิ่มอาคารเรียบร้อยแล้ว");
    await loadAll();
  }

  async function deleteBuilding(id: string, name: string) {
    if (!confirm(`ยืนยันการลบ "${name}" และห้องทั้งหมดในอาคารนี้?`)) return;
    setMsg("");
    setErr("");
    const sb = createClient();
    const { error } = await sb.from("buildings").delete().eq("id", id);
    if (error) {
      setErr("ลบไม่สำเร็จ: " + error.message);
      return;
    }
    setMsg("ลบอาคารเรียบร้อยแล้ว");
    await loadAll();
  }

  async function addLocation(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setErr("");
    if (!selBuilding || (!newFloor.trim() && !newRoom.trim())) {
      setErr("กรุณาเลือกอาคารและระบุชั้นหรือห้อง");
      return;
    }
    const sb = createClient();
    const { error } = await sb.from("locations").insert({
      building_id: selBuilding,
      floor: newFloor.trim() || null,
      room: newRoom.trim() || null,
    });
    if (error) {
      setErr("เพิ่มห้องไม่สำเร็จ: " + error.message);
      return;
    }
    setNewFloor("");
    setNewRoom("");
    setMsg("เพิ่มข้อมูลห้อง/สถานที่เรียบร้อยแล้ว");
    await loadAll();
  }

  async function deleteLocation(id: string) {
    setMsg("");
    setErr("");
    const sb = createClient();
    const { error } = await sb.from("locations").delete().eq("id", id);
    if (error) {
      setErr("ลบห้องไม่สำเร็จ: " + error.message);
      return;
    }
    setMsg("ลบห้องเรียบร้อยแล้ว");
    await loadAll();
  }

  async function updateUserProfile(
    userId: string,
    fullName: string,
    role: "admin" | "technician" | "staff"
  ) {
    setMsg("");
    setErr("");
    const sb = createClient();
    const { error } = await sb
      .from("profiles")
      .update({ full_name: fullName, role })
      .eq("id", userId);
    if (error) {
      setErr("อัปเดตผู้ใช้ไม่สำเร็จ: " + error.message);
      return;
    }
    setMsg("บันทึกข้อมูลผู้ใช้เรียบร้อยแล้ว");
    await loadAll();
  }

  if (authorized === null) {
    return (
      <main className="shell">
        <Nav />
        <div className="card">กำลังตรวจสอบสิทธิ์...</div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="shell">
        <Nav />
        <div className="card">เฉพาะ Admin เท่านั้น</div>
      </main>
    );
  }

  return (
    <main className="shell">
      <Nav />
      <div className="stack">
        <div>
          <h1>จัดการระบบ (Admin)</h1>
          <div className="muted">จัดการรายชื่ออาคาร ห้องเรียน และสิทธิ์ผู้ใช้งานในโรงเรียน</div>
        </div>

        {msg && <div className="notice">{msg}</div>}
        {err && <div className="notice error">{err}</div>}

        <div className="grid2">
          {/* จัดการอาคาร */}
          <div className="card">
            <h2>1. จัดการอาคาร / สถานที่หลัก</h2>
            <form onSubmit={addBuilding} className="row" style={{ marginBottom: 14 }}>
              <input
                style={{ flex: 1 }}
                placeholder="เช่น อาคาร 1, โรงอาหาร, อาคารอเนกประสงค์"
                value={newBuilding}
                onChange={(e) => setNewBuilding(e.target.value)}
                required
              />
              <button className="btn primary" type="submit">＋ เพิ่มอาคาร</button>
            </form>
            <div className="stack" style={{ gap: 8 }}>
              {buildings.map((b) => (
                <div
                  key={b.id}
                  className="row"
                  style={{
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "#f8fafc",
                    borderRadius: 10,
                  }}
                >
                  <span>🏢 {b.name}</span>
                  <button
                    type="button"
                    className="btn"
                    style={{ background: "#fee2e2", color: "#991b1b", padding: "6px 10px" }}
                    onClick={() => deleteBuilding(b.id, b.name)}
                  >
                    ลบ
                  </button>
                </div>
              ))}
              {buildings.length === 0 && <p className="muted">ยังไม่มีข้อมูลอาคาร</p>}
            </div>
          </div>

          {/* จัดการชั้น / ห้อง */}
          <div className="card">
            <h2>2. จัดการชั้นและห้องเรียน</h2>
            <form onSubmit={addLocation}>
              <label>เลือกอาคาร</label>
              <select
                value={selBuilding}
                onChange={(e) => setSelBuilding(e.target.value)}
                required
              >
                <option value="">-- เลือกอาคาร --</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <div className="grid2">
                <div>
                  <label>ชั้น</label>
                  <input
                    placeholder="เช่น ชั้น 2"
                    value={newFloor}
                    onChange={(e) => setNewFloor(e.target.value)}
                  />
                </div>
                <div>
                  <label>ห้อง / จุดย่อย</label>
                  <input
                    placeholder="เช่น ห้อง 201, ห้องน้ำ"
                    value={newRoom}
                    onChange={(e) => setNewRoom(e.target.value)}
                  />
                </div>
              </div>
              <button
                className="btn primary"
                type="submit"
                style={{ marginTop: 12 }}
                disabled={buildings.length === 0}
              >
                ＋ เพิ่มห้อง
              </button>
            </form>

            <div className="stack" style={{ gap: 8, marginTop: 16, maxHeight: 240, overflowY: "auto" }}>
              {locations.map((loc) => (
                <div
                  key={loc.id}
                  className="row"
                  style={{
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "#f8fafc",
                    borderRadius: 10,
                    fontSize: 14,
                  }}
                >
                  <span>
                    <b>{loc.buildings?.name}</b> ·{" "}
                    {[loc.floor, loc.room].filter(Boolean).join(" ")}
                  </span>
                  <button
                    type="button"
                    className="btn"
                    style={{ background: "#fee2e2", color: "#991b1b", padding: "4px 10px" }}
                    onClick={() => deleteLocation(loc.id)}
                  >
                    ลบ
                  </button>
                </div>
              ))}
              {locations.length === 0 && <p className="muted">ยังไม่มีข้อมูลห้องย่อย</p>}
            </div>
          </div>
        </div>

        {/* จัดการสิทธิ์ผู้ใช้ */}
        <div className="card">
          <h2>3. จัดการบุคลากรและสิทธิ์การใช้งาน (Roles)</h2>
          <p className="muted" style={{ marginBottom: 12 }}>
            กำหนดบทบาท: <b>staff</b> (ครู/บุคลากรแจ้งซ่อม), <b>technician</b> (ช่างซ่อม), <b>admin</b> (ผู้ดูแลระบบ) · คลิกที่ช่องชื่อเพื่อเลือกจากรายการหรือพิมพ์ชื่อใหม่ได้ทันที
          </p>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 200 }}>อีเมล</th>
                  <th style={{ minWidth: 250 }}>ชื่อ - นามสกุล</th>
                  <th style={{ minWidth: 200 }}>บทบาท (Role)</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((u) => (
                  <UserRow
                    key={u.id}
                    profile={u}
                    suggestions={existingNames}
                    onSave={updateUserProfile}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

function NameCombobox({
  value,
  onChange,
  suggestions,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  suggestions: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 260 });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  function updatePosition() {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 250),
    });
  }

  function openMenu() {
    updatePosition();
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        inputRef.current &&
        !inputRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handleScroll(e: Event) {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  const filteredNames = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return suggestions;
    return suggestions.filter((name) => name.toLowerCase().includes(q));
  }, [suggestions, value]);

  return (
    <div style={{ position: "relative" }}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder={placeholder}
        style={{ paddingRight: 34 }}
        onFocus={openMenu}
        onClick={openMenu}
        onChange={(e) => {
          onChange(e.target.value);
          if (!open) openMenu();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="เลือกรายชื่อ"
        onClick={() => (open ? setOpen(false) : openMenu())}
        style={{
          position: "absolute",
          right: 6,
          top: "50%",
          transform: "translateY(-50%)",
          border: 0,
          background: "transparent",
          color: "#64748b",
          cursor: "pointer",
          padding: "4px 6px",
          fontSize: 13,
        }}
      >
        ▾
      </button>

      {open && (
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: pos.width,
            maxHeight: 240,
            overflowY: "auto",
            background: "white",
            border: "1px solid #cfd8e5",
            borderRadius: 10,
            boxShadow: "0 10px 25px rgba(15, 23, 42, 0.12)",
            zIndex: 9999,
            padding: 6,
          }}
        >
          {filteredNames.length > 0 && (
            <>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#64748b",
                  padding: "4px 8px",
                }}
              >
                รายชื่อที่มีในระบบ
              </div>
              {filteredNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    onChange(name);
                    setOpen(false);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "7px 10px",
                    border: 0,
                    borderRadius: 7,
                    background: name === value ? "#eff6ff" : "transparent",
                    color: "#172033",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  👤 {name}
                </button>
              ))}
            </>
          )}

          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#64748b",
              padding: "6px 8px 4px",
              borderTop: filteredNames.length > 0 ? "1px solid #edf0f5" : undefined,
              marginTop: filteredNames.length > 0 ? 4 : 0,
            }}
          >
            คำนำหน้าชื่อ (คลิกเพื่อเติมแล้วพิมพ์ชื่อต่อ)
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "2px 6px 6px" }}>
            {TITLE_PREFIXES.map((prefix) => (
              <button
                key={prefix}
                type="button"
                onClick={() => {
                  const stripped = value.replace(/^(นาย|นางสาว|นาง|ว่าที่ ร\.ต\.)\s*/, "");
                  onChange(prefix + stripped);
                  setOpen(false);
                  inputRef.current?.focus();
                }}
                style={{
                  border: "1px solid #dbe3ef",
                  background: "#f8fafc",
                  color: "#20334e",
                  borderRadius: 6,
                  padding: "4px 8px",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {prefix.trim()}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UserRow({
  profile,
  suggestions,
  onSave,
}: {
  profile: ProfileItem;
  suggestions: string[];
  onSave: (id: string, fullName: string, role: "admin" | "technician" | "staff") => Promise<void>;
}) {
  const [name, setName] = useState(profile.full_name);
  const [role, setRole] = useState<"admin" | "technician" | "staff">(profile.role);
  const [saving, setSaving] = useState(false);

  return (
    <tr>
      <td>
        <div style={{ fontWeight: 500 }}>{profile.email || "-"}</div>
        <div className="muted" style={{ fontSize: 11 }}>
          ID: {profile.id.slice(0, 8)}...
        </div>
      </td>
      <td>
        <NameCombobox
          value={name}
          onChange={setName}
          suggestions={suggestions}
          placeholder="เลือกจากรายการ หรือพิมพ์ชื่อ-นามสกุล"
        />
      </td>
      <td>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "admin" | "technician" | "staff")}
        >
          <option value="staff">staff (ครู / บุคลากร)</option>
          <option value="technician">technician (ช่างซ่อม)</option>
          <option value="admin">admin (ผู้ดูแลระบบ)</option>
        </select>
      </td>
      <td>
        <button
          type="button"
          className="btn primary"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            await onSave(profile.id, name.trim(), role);
            setSaving(false);
          }}
        >
          {saving ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </td>
    </tr>
  );
}
