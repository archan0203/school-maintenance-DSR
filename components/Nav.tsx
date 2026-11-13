"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

export default function Nav() {
  const pathname = usePathname();
  const [label, setLabel] = useState("กำลังโหลด...");
  const [role, setRole] = useState("");

  useEffect(() => {
    (async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        setLabel("ผู้ใช้");
        return;
      }
      const { data: p } = await sb
        .from("profiles")
        .select("full_name,role")
        .eq("id", user.id)
        .maybeSingle();
      setRole(p?.role || "staff");
      setLabel(`${p?.full_name || user.email} · ${p?.role || "staff"}`);
    })();
  }, []);

  const linkStyle = (href: string) =>
    pathname === href ? { background: "#1d4ed8", color: "white" } : undefined;

  return (
    <>
      <header className="top">
        <div>
          <div className="brand">🏫 SCHOOL MAINTENANCE</div>
          <div style={{ fontSize: 12, color: "#cbd5e1" }}>
            ระบบบริหารจัดการงานซ่อมแซมโรงเรียน
          </div>
        </div>
        <div style={{ fontSize: 13 }}>{label}</div>
      </header>
      <nav className="nav">
        <Link href="/" style={linkStyle("/")}>ภาพรวม</Link>
        <Link href="/requests/new" style={linkStyle("/requests/new")}>แจ้งซ่อม</Link>
        <Link href="/requests" style={linkStyle("/requests")}>รายการงาน</Link>
        {(role === "admin" || role === "technician") && (
          <Link href="/reports" style={linkStyle("/reports")}>รายงาน</Link>
        )}
        {role === "admin" && (
          <Link href="/admin" style={linkStyle("/admin")}>จัดการระบบ (Admin)</Link>
        )}
        <form action="/auth/signout" method="post">
          <button className="btn" type="submit">ออกจากระบบ</button>
        </form>
      </nav>
    </>
  );
}
