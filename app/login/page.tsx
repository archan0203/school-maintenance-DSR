"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const supabase = createClient();

    if (isRegister) {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName.trim() },
        },
      });
      if (signUpError) {
        setError("ลงทะเบียนไม่สำเร็จ: " + signUpError.message);
        setBusy(false);
        return;
      }
      if (data.session) {
        window.location.href = "/";
        return;
      }
      setNotice("ลงทะเบียนสำเร็จ! กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี หรือติดต่อ Admin เพื่อเปิดใช้งาน");
      setBusy(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setError("เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลและรหัสผ่าน");
      setBusy(false);
      return;
    }
    window.location.href = "/";
  }

  return (
    <main className="shell" style={{ maxWidth: 520, paddingTop: 60 }}>
      <div className="card">
        <div style={{ fontSize: 32 }}>🏫</div>
        <h1>{isRegister ? "ลงทะเบียนบุคลากรใหม่" : "เข้าสู่ระบบ"}</h1>
        <p className="muted">ระบบบริหารจัดการงานซ่อมแซมโรงเรียน</p>

        <div className="row" style={{ marginTop: 14 }}>
          <button
            type="button"
            className={`btn ${!isRegister ? "primary" : ""}`}
            onClick={() => { setIsRegister(false); setError(""); setNotice(""); }}
          >
            เข้าสู่ระบบ
          </button>
          <button
            type="button"
            className={`btn ${isRegister ? "primary" : ""}`}
            onClick={() => { setIsRegister(true); setError(""); setNotice(""); }}
          >
            ลงทะเบียนใหม่
          </button>
        </div>

        <form onSubmit={submit}>
          {isRegister && (
            <>
              <label>ชื่อ - นามสกุล *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="เช่น นายสมชาย ใจดี"
              />
            </>
          )}
          <label>อีเมล *</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@school.ac.th"
          />
          <label>รหัสผ่าน * {isRegister && "(อย่างน้อย 6 ตัวอักษร)"}</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <div className="notice error">{error}</div>}
          {notice && <div className="notice">{notice}</div>}

          <button
            className="btn primary"
            style={{ width: "100%", justifyContent: "center", marginTop: 18 }}
            disabled={busy}
          >
            {busy
              ? "กำลังดำเนินการ..."
              : isRegister
              ? "สมัครสมาชิก"
              : "เข้าสู่ระบบ"}
          </button>
        </form>
      </div>
    </main>
  );
}
